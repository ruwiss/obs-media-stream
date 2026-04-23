const container = document.getElementById('media-container');

// Sayfa ilk yüklendiğinde mevcut medyayı getir
fetch('http://localhost:3000/current')
  .then(res => res.json())
  .then(data => {
    if (data.media && data.media.url) {
      renderMedia(data.media);
    }
  });

// Server-Sent Events (SSE) ile sunucudaki canlı değişiklikleri dinliyoruz
const evtSource = new EventSource('http://localhost:3000/events');
evtSource.onmessage = function(event) {
  const media = JSON.parse(event.data);
  renderMedia(media);
};

// Gelen veriye göre ekranı çizen fonksiyon
function renderMedia(media) {
  container.innerHTML = ''; // Eski içeriği temizle

  if (media.type === 'image') {
    const img = document.createElement('img');
    img.src = media.url;
    container.appendChild(img);
  } 
  else if (media.type === 'video') {
    const vid = document.createElement('video');
    vid.src = media.url;
    vid.autoplay = true;
    vid.loop = true;
    vid.controls = false; // Kontrolleri gizliyoruz
    container.appendChild(vid);
  }
  else if (media.type === 'youtube') {
    // YouTube için otomatik oynatılan özel bir iframe oluşturuyoruz
    const iframe = document.createElement('iframe');
    // URL formatı: videoId?t=saniye (Örn: dQw4w9WgXcQ?t=120)
    // iframe src formatı: https://www.youtube.com/embed/videoId?start=saniye&autoplay=1
    const [videoId, timeParams] = media.url.split('?t=');
    const startTime = timeParams ? `&start=${timeParams}` : '';
    
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1${startTime}`;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.allow = 'autoplay; encrypted-media';
    container.appendChild(iframe);
  }
}
