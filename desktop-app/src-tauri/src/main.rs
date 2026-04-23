#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::sync::Arc;
use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    WindowBuilder, WindowUrl,
};
use tokio::sync::broadcast;
use parking_lot::Mutex;

use ax_ws::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State as AxumState,
    },
    http::{header, Method, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use axum as ax_ws;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

use sha2::{Digest, Sha256};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message as WsMsg};

#[derive(Clone, Serialize, Deserialize, Debug)]
struct MediaData {
    #[serde(rename = "type")]
    media_type: String,
    url: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct MediaRequest {
    #[serde(rename = "type")]
    media_type: String,
    url: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, Debug, Default)]
struct AppConfig {
    obs_url: String,
    obs_password: String,
    obs_scene: String,
    obs_source: String,
}

#[derive(Clone, Debug)]
struct SenderMsg {
    sender_id: u64,
    content: String,
}

struct AppState {
    current_media: Mutex<MediaData>,
    config: Mutex<AppConfig>,
    tx: broadcast::Sender<SenderMsg>,
}

fn get_config_path(app_handle: &tauri::AppHandle) -> std::path::PathBuf {
    let mut path = app_handle
        .path_resolver()
        .app_config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("config.json");
    path
}

// --- OBS KONTROL MOTORU ---

async fn update_obs_source(state: Arc<AppState>, page_name: &str) -> Result<(), String> {
    let config = state.config.lock().clone();
    let obs_url = if config.obs_url.starts_with("ws://") { 
        config.obs_url.clone() 
    } else { 
        format!("ws://{}", config.obs_url) 
    };
    
    let (ws_stream, _) = connect_async(&obs_url)
        .await
        .map_err(|e| format!("OBS Bağlantı Hatası: {}", e))?;
    
    let (mut write, mut read) = ws_stream.split();

    let hello_msg = read.next().await.ok_or("OBS'den cevap gelmedi")?.map_err(|e| e.to_string())?;
    let hello_json: serde_json::Value = serde_json::from_str(&hello_msg.to_text().unwrap_or("{}")).unwrap();
    
    let mut identify_req = json!({
        "op": 1,
        "d": {
            "rpcVersion": 1
        }
    });

    if let Some(auth_info) = hello_json["d"]["authentication"].as_object() {
        let challenge = auth_info["challenge"].as_str().unwrap();
        let salt = auth_info["salt"].as_str().unwrap();
        
        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}", config.obs_password, salt));
        let secret = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hasher.finalize());

        let mut hasher = Sha256::new();
        hasher.update(format!("{}{}", secret, challenge));
        let auth_resp = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, hasher.finalize());

        identify_req["d"]["authentication"] = json!(auth_resp);
    }

    write.send(WsMsg::Text(identify_req.to_string())).await.map_err(|e| e.to_string())?;

    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let overlay_url = format!("http://localhost:3000/overlay/{}?t={}", page_name, now);
    let custom_css = "body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }";

    let request = json!({
        "op": 6,
        "d": {
            "requestType": "SetInputSettings",
            "requestId": format!("req_{}", now),
            "requestData": {
                "inputName": config.obs_source,
                "inputSettings": {
                    "url": overlay_url,
                    "css": custom_css
                }
            }
        }
    });

    write.send(WsMsg::Text(request.to_string())).await.map_err(|e| e.to_string())?;
    println!("🚀 OBS Kaynağı Güncellendi: {}", page_name);
    
    Ok(())
}

// --- TAURI KOMUTLARI ---

#[tauri::command]
fn get_config(state: tauri::State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
    let config = state.config.lock();
    Ok(config.clone())
}

#[tauri::command]
fn save_config(
    config: AppConfig,
    state: tauri::State<'_, Arc<AppState>>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let path = get_config_path(&app_handle);
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())?;
    let mut current_config = state.config.lock();
    *current_config = config;
    println!("✅ Ayarlar Güncellendi.");
    Ok(())
}

#[tokio::main]
async fn main() {
    let (tx, _rx) = broadcast::channel(100);
    let state = Arc::new(AppState {
        current_media: Mutex::new(MediaData { media_type: "clear".to_string(), url: "".to_string() }),
        config: Mutex::new(AppConfig {
            obs_url: "ws://127.0.0.1:4455".to_string(),
            obs_password: "".to_string(),
            obs_scene: "Sahne".to_string(),
            obs_source: "HelperImage".to_string(),
        }),
        tx,
    });

    let state_clone = state.clone();
    tokio::spawn(async move {
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers([header::CONTENT_TYPE]);
            
        let app = Router::new()
            .route("/media", post(handle_media))
            .route("/current", get(handle_current))
            .route("/ws", get(ws_handler))
            .route("/", get(ws_handler))
            // Dosyaları doğrudan .exe içerisine gömüyoruz (Portable yapı için)
            .route("/overlay/index.html", get(|| async { ax_ws::response::Html(include_str!("../../../overlay/index.html")) }))
            .route("/overlay/webrtc.html", get(|| async { ax_ws::response::Html(include_str!("../../../overlay/webrtc.html")) }))
            .route("/overlay/stream.html", get(|| async { ax_ws::response::Html(include_str!("../../../overlay/stream.html")) }))
            .route("/overlay/overlay.css", get(|| async { ([(header::CONTENT_TYPE, "text/css")], include_str!("../../../overlay/overlay.css")) }))
            .route("/overlay/overlay.js", get(|| async { ([(header::CONTENT_TYPE, "application/javascript")], include_str!("../../../overlay/overlay.js")) }))
            .layer(cors)
            .with_state(state_clone);
            
        let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
        println!("📡 HTTP/WS Sunucusu 3000 portunda aktif.");
        ax_ws::serve(listener, app).await.unwrap();
    });

    tauri::Builder::default()
        .manage(state.clone())
        .system_tray(SystemTray::new().with_menu(
            SystemTrayMenu::new()
                .add_item(CustomMenuItem::new("status".to_string(), "🟢 OBS Helper Çalışıyor").disabled())
                .add_native_item(SystemTrayMenuItem::Separator)
                .add_item(CustomMenuItem::new("settings".to_string(), "⚙️ Ayarlar"))
                .add_item(CustomMenuItem::new("quit".to_string(), "❌ Çıkış")),
        ))
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => { std::process::exit(0); }
                "settings" => {
                    let _ = WindowBuilder::new(app, "settings", WindowUrl::App("settings.html".into()))
                        .title("OBS Helper Ayarları").inner_size(400.0, 450.0).resizable(false).always_on_top(true).build();
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            let path = get_config_path(&app.handle());
            if path.exists() {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(saved_config) = serde_json::from_str::<AppConfig>(&content) {
                        let state = app.state::<Arc<AppState>>();
                        let mut config = state.config.lock();
                        *config = saved_config;
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_config, save_config])
        .run(tauri::generate_context!())
        .expect("Tauri çalıştırılırken hata oluştu");
}

async fn handle_media(
    AxumState(state): AxumState<Arc<AppState>>,
    Json(payload): Json<MediaRequest>,
) -> impl IntoResponse {
    let url = payload.url.clone().unwrap_or_default();
    let mut current = state.current_media.lock();
    current.media_type = payload.media_type.clone();
    current.url = url.clone();

    let page = if current.media_type == "webrtc" { "webrtc.html" } else { "index.html" };

    let update_msg = json!({ "type": "media_update", "media": *current }).to_string();
    // Sistem mesajları için sender_id: 0 kullanıyoruz (herkese gider)
    let _ = state.tx.send(SenderMsg { sender_id: 0, content: update_msg });

    let state_c = state.clone();
    let page_c = page.to_string();
    tokio::spawn(async move {
        if let Err(e) = update_obs_source(state_c, &page_c).await {
            eprintln!("🔴 OBS Güncelleme Hatası: {}", e);
        }
    });

    (StatusCode::OK, Json(json!({ "success": true })))
}

async fn handle_current(AxumState(state): AxumState<Arc<AppState>>) -> impl IntoResponse {
    let current = state.current_media.lock();
    (StatusCode::OK, Json(json!({ "success": true, "media": *current })))
}

async fn ws_handler(ws: WebSocketUpgrade, AxumState(state): AxumState<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let my_id = NEXT_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();
    
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            // Sadece başkası tarafından gönderilen mesajları veya sistem (0) mesajlarını ilet
            if msg.sender_id != my_id {
                if sender.send(Message::Text(msg.content)).await.is_err() { 
                    break; 
                }
            }
        }
    });
    
    let tx = state.tx.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg { 
                let _ = tx.send(SenderMsg { sender_id: my_id, content: text }); 
            }
        }
    });
    
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}
