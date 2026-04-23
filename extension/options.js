// Sayfa yüklendiğinde çalışacak işlemler
document.addEventListener('DOMContentLoaded', () => {
  const helperUrlInput = document.getElementById('helperUrl');
  const saveButton = document.getElementById('save');
  const statusText = document.getElementById('status');

  // Tarayıcı hafızasına kaydedilmiş mevcut ayarı yükleriz
  // Eğer ayar yoksa varsayılan olarak http://localhost:3000 gelir
  chrome.storage.sync.get({ helperUrl: 'http://localhost:3000' }, (data) => {
    helperUrlInput.value = data.helperUrl;
  });

  // Kaydet butonuna tıklandığında ayarı kaydederiz
  saveButton.addEventListener('click', () => {
    const url = helperUrlInput.value;
    
    chrome.storage.sync.set({ helperUrl: url }, () => {
      // Kullanıcıya bilgi veriyoruz
      statusText.textContent = 'Ayarlar başarıyla kaydedildi!';
      
      // 2 saniye sonra bilgi mesajını gizliyoruz
      setTimeout(() => {
        statusText.textContent = '';
      }, 2000);
    });
  });
});
