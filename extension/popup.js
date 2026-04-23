const statusText = document.getElementById('status-text');
const actionBtn = document.getElementById('action-btn');

function updateUI(state) {
  if (state === 'idle') {
    statusText.innerHTML = "<span style='color:#a0a0a0'>Durum: Bekleniyor</span>";
    actionBtn.className = "btn btn-primary";
    actionBtn.textContent = "VİDEO SEÇİCİ BAŞLAT";
  } 
  else if (state === 'picking') {
    statusText.innerHTML = "<span style='color:#ffb900'>Sayfadan video seçin...</span>";
    actionBtn.className = "btn btn-warning";
    actionBtn.textContent = "Seçimi İptal Et (Ekranı Temizle)";
  } 
  else if (state === 'connecting') {
    statusText.innerHTML = "<span style='color:#ffb900'>OBS'e Bağlanılıyor...</span>";
    actionBtn.className = "btn btn-warning";
    actionBtn.textContent = "Bağlantıyı İptal Et";
  } 
  else if (state === 'live') {
    statusText.innerHTML = "<div style='display:flex; align-items:center'><span class='live-dot'></span> <span style='color:#ff3b30; font-weight:bold;'>OBS CANLI YAYINDA</span></div>";
    actionBtn.className = "btn btn-danger";
    actionBtn.textContent = "YAYINI DURDUR VE EKRANI TEMİZLE";
  }
}

chrome.runtime.sendMessage({ type: 'get_state' }, (res) => {
  if (res && res.state) updateUI(res.state);
});

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
      // Picker modundayken, bağlanırken veya canlı yayındayken "İptal" edilirse
      // eklenti OBS ekranını tamamen "temizle"mesi için arka plana zorla durdur komutu yollar.
      chrome.runtime.sendMessage({ type: 'stop_stream_command' });
      updateUI('idle');
    }
  });
});
