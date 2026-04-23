let ws = null;
let currentStreamingTabId = null;
let extensionState = 'idle'; // idle, picking, connecting, live

function setState(newState) {
  extensionState = newState;
  chrome.runtime.sendMessage({ type: 'state_changed', state: extensionState }).catch(() => {});
}

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

function connectWs() {
  return new Promise((resolve) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve(); return;
    }
    ws = new WebSocket('ws://localhost:3000');
    ws.onopen = () => { resolve(); };
    ws.onmessage = (event) => {
      if (currentStreamingTabId) {
        chrome.tabs.sendMessage(currentStreamingTabId, { type: 'webrtc_signal', data: JSON.parse(event.data) }).catch(()=>{});
      }
    };
    ws.onclose = () => { ws = null; };
  });
}

// Popup'tan, Picker'dan gelen tüm mesajları burada dinliyor ve aracılık yapıyoruz
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'get_state') {
    sendResponse({ state: extensionState });
  } 
  else if (req.type === 'set_state') {
    setState(req.state);
  }
  else if (req.type === 'start_picker_command') {
    setState('picking');
    chrome.scripting.executeScript({ target: { tabId: req.tabId }, files: ['picker.js'] });
  }
  else if (req.type === 'stop_stream_command') {
    if (currentStreamingTabId) {
      chrome.tabs.sendMessage(currentStreamingTabId, { type: 'force_stop' }).catch(()=>{});
    }
    setState('idle');
  }
  else if (req.type === 'start_webrtc') {
    currentStreamingTabId = sender.tab.id;
    setState('connecting');
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
