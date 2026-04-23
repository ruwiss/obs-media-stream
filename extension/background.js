let ws = null;
let currentStreamingTabId = null;

// Eklenti yüklendiğinde
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-obs",
    title: "OBS'de Göster (Resim)",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "send-to-obs") {
    fetch('http://localhost:3000/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'image', url: info.srcUrl })
    }).catch(() => {});
  }
});

// Arka planda OBS ile sürekli iletişim kuracak bir WebSocket bağlayalım
function connectWs() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  ws = new WebSocket('ws://localhost:3000');
  
  ws.onmessage = (event) => {
    // OBS'ten (Receiver) gelen sinyalleri doğrudan o an yayını yapan Chrome Sekmesine yolla
    if (currentStreamingTabId) {
      chrome.tabs.sendMessage(currentStreamingTabId, { type: 'webrtc_signal', data: JSON.parse(event.data) }).catch(()=>{});
    }
  };

  ws.onclose = () => {
    ws = null;
    setTimeout(connectWs, 2000); // Koptukça tekrar bağlan
  };
}
connectWs();

// Eklenti İkonuna Tıklandığında Picker (Seçici) Başlasın
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://')) return;
  
  console.log("Seçici Başlatılıyor...");
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['picker.js']
  });
});

// Chrome Sekmesinden (Picker) Gelen İstekleri Yakala
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'start_webrtc') {
    currentStreamingTabId = sender.tab.id;
    // Helper'a haber ver ki OBS'in adresini webrtc.html sayfasına çevirsin
    fetch('http://localhost:3000/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'webrtc', url: 'canli-yayin' })
    }).catch(console.error);
    
    sendResponse({ success: true });
  } 
  else if (req.type === 'webrtc_signal' && ws && ws.readyState === WebSocket.OPEN) {
    // Sekmeden (Sender) gelen sinyali OBS'e gönder
    ws.send(JSON.stringify(req.data));
  }
  return true;
});
