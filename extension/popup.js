const statusText = document.getElementById('status-text');
const actionBtn = document.getElementById('action-btn');
const offlineWarning = document.getElementById('offline-warning');
let isServerOnline = false;

// Sunucu bağlantısını test et
async function checkServerHealth() {
  try {
    const res = await fetch('http://localhost:3000/current');
    if (!res.ok) throw new Error('Sunucu hatası');
    
    isServerOnline = true;
    offlineWarning.style.display = 'none';
    actionBtn.disabled = false;
    
    // Sunucu açıksa eklentinin mevcut durumunu (state) arka plandan iste
    chrome.runtime.sendMessage({ type: 'get_state' }, (response) => {
      if (response && response.state) updateUI(response.state);
    });
  } catch (err) {
    isServerOnline = false;
    offlineWarning.style.display = 'block';
    actionBtn.disabled = true;
    statusText.innerHTML = "<span style='color:#a0a0a0'>Bağlantı Bekleniyor...</span>";
  }
}

function updateUI(state) {
  if (!isServerOnline) return;

  if (state === 'idle') {
    statusText.innerHTML = "<span style='color:#a0a0a0'>Durum: Bekleniyor</span>";
    actionBtn.className = "btn btn-primary";
    actionBtn.textContent = "VİDEO SEÇİCİ BAŞLAT";
  } 
  else if (state === 'picking') {
    statusText.innerHTML = "<span style='color:#ffb900'>Sayfadan video seçin...</span>";
    actionBtn.className = "btn btn-warning";
    actionBtn.textContent = "Seçimi İptal Et";
  } 
  else if (state === 'connecting') {
    statusText.innerHTML = "<span style='color:#ffb900'>OBS'e Bağlanılıyor...</span>";
    actionBtn.className = "btn btn-warning";
    actionBtn.textContent = "Bağlantıyı İptal Et";
  } 
  else if (state === 'live') {
    statusText.innerHTML = "<div style='display:flex; align-items:center'><span class='live-dot'></span> <span style='color:#ff3b30; font-weight:bold;'>OBS CANLI YAYINDA</span></div>";
    actionBtn.className = "btn btn-danger";
    actionBtn.textContent = "YAYINI DURDUR (TEMİZLE)";
  }
}

// Arayüz açılır açılmaz sunucuyu kontrol et
checkServerHealth();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'state_changed') {
    updateUI(msg.state);
  }
});

actionBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'get_state' }, (res) => {
    const state = res.state;
    
    if (state === 'idle') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.runtime.sendMessage({ type: 'start_picker_command', tabId: tabs[0].id });
      });
      updateUI('picking');
    } 
    else {
      chrome.runtime.sendMessage({ type: 'stop_stream_command' });
      updateUI('idle');
    }
  });
});
