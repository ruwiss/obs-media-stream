// Bu kod, yayınlanan sekmeye sadece "Yayını Durdur" butonu eklemek için kullanılır
if (!document.getElementById('obs-helper-stream-panel')) {
  const panel = document.createElement('div');
  panel.id = 'obs-helper-stream-panel';
  panel.innerHTML = `
    <div style="position: fixed; top: 10px; right: 10px; background: rgba(255,0,0,0.8); color: white; padding: 10px; border-radius: 5px; z-index: 999999; font-family: sans-serif; display: flex; align-items: center; gap: 10px;">
      <div style="width: 10px; height: 10px; background: white; border-radius: 50%; animation: pulse 1s infinite;"></div>
      <span>OBS Canlı Yayında</span>
      <button id="obs-helper-stop-btn" style="margin-left: 10px; padding: 5px 10px; cursor: pointer; border: none; background: white; color: red; border-radius: 3px; font-weight: bold;">Durdur</button>
    </div>
    <style>
      @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
    </style>
  `;
  document.body.appendChild(panel);

  document.getElementById('obs-helper-stop-btn').addEventListener('click', () => {
    panel.remove();
    // Background'a durdurma sinyali gönderilebilir
    console.log("OBS Yayını durduruldu (Görsel panel kapatıldı).");
  });
}
