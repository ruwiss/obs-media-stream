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
    // OBS'ye resmi yollama fonksiyonu (Güvenilir olması için asenkron yapıldı)
    const sendImage = async () => {
      try {
        const response = await fetch('http://localhost:3000/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'image', url: info.srcUrl })
        });
        if (!response.ok) throw new Error("Sunucu yanıt vermedi.");
      } catch (err) {
        console.error("İlk denemede hata oluştu, tekrar deneniyor...", err);
        // Hata olursa 500ms sonra 1 kere daha dene (İlk açılış gecikmelerine karşı)
        setTimeout(() => {
          fetch('http://localhost:3000/media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'image', url: info.srcUrl })
          }).catch(console.error);
        }, 500);
      }
    };
    
    sendImage();
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

// KLAVYE KISAYOLU DİNLEYİCİSİ (Alt+S)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-picker") {
    try {
      const res = await fetch('http://localhost:3000/current');
      if (!res.ok) return;
    } catch(e) {
      return;
    }

    if (extensionState === 'idle') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && !tabs[0].url.startsWith('chrome://')) {
          setState('picking');
          chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['picker.js'] });
        }
      });
    } 
    else if (extensionState === 'live' || extensionState === 'connecting') {
      if (currentStreamingTabId) {
        chrome.tabs.sendMessage(currentStreamingTabId, { type: 'force_stop' }).catch(()=>{});
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && !tabs[0].url.startsWith('chrome://')) {
          setState('picking');
          chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['picker.js'] });
        }
      });
    }
    else if (extensionState === 'picking') {
      setState('idle');
    }
  }
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === 'heartbeat') {
    sendResponse({ ok: true });
    return true;
  }
  else if (req.type === 'get_state') {
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
    currentStreamingTabId = null;
    fetch('http://localhost:3000/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clear', url: '' })
    }).catch(()=>{});
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
