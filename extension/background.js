let ws = null;
let currentStreamingTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "send-to-obs", title: "OBS'de Göster (Resim)", contexts: ["image"] });
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

// Promise tabanlı güvenli WebSocket bağlantısı
function connectWs() {
  return new Promise((resolve) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    
    ws = new WebSocket('ws://localhost:3000');
    
    ws.onopen = () => {
      resolve(); // Bağlantı KESİN olarak açıldığında işlemi serbest bırak
    };

    ws.onmessage = (event) => {
      if (currentStreamingTabId) {
        chrome.tabs.sendMessage(currentStreamingTabId, { type: 'webrtc_signal', data: JSON.parse(event.data) }).catch(()=>{});
      }
    };

    ws.onclose = () => {
      ws = null;
    };
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith('chrome://')) return;
  chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] });
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'start_webrtc') {
    currentStreamingTabId = sender.tab.id;
    
    // ÖNEMLİ: Önce arka plan WebSocket'in KESİN açık olduğundan emin oluyoruz.
    // Açıldıktan sonra OBS'e sayfayı değiştirmesi için komut atıyoruz.
    // Böylece OBS'ten gelecek "Hazırım" sinyalini (receiver_ready) asla kaçırmayız.
    connectWs().then(() => {
       fetch('http://localhost:3000/media', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ type: 'webrtc', url: 'canli-yayin' })
       }).catch(console.error);
    });
    
    sendResponse({ success: true });
  } 
  else if (req.type === 'webrtc_signal') {
    connectWs().then(() => {
       ws.send(JSON.stringify(req.data));
    });
  }
  return true;
});
