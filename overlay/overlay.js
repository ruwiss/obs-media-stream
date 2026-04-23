const container = document.getElementById('media-container');

// Sayfa ilk yüklendiğinde mevcut medyayı getir
fetch('http://localhost:3000/current')
  .then(res => res.json())
  .then(data => {
    if (data.media && data.media.url && data.media.type !== 'clear') {
      renderMedia(data.media);
    }
  });

const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = function(event) {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'media_update') {
      renderMedia(data.media);
    }
  } catch (err) {
    // Hataları yoksay
  }
};

ws.onclose = () => {
  console.log("Sunucu ile bağlantı koptu. Yeniden bağlanılacak...");
};

function renderMedia(media) {
  // Eski içeriği her halükarda temizle
  container.innerHTML = '';

  // Eğer 'clear' veya 'stop_webrtc' geldiyse, sayfa boş ve şeffaf kalacak demektir.
  if (media.type === 'clear') {
     return; // Ekstra hiçbir şey ekleme (Siyah/Şeffaf Ekran)
  }

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
    vid.controls = false;
    container.appendChild(vid);
  }
  else if (media.type === 'youtube') {
    const iframe = document.createElement('iframe');
    const [videoId, timeParams] = media.url.split('?t=');
    const startTime = timeParams ? `&start=${timeParams}` : '';
    
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1${startTime}`;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.allow = 'autoplay; encrypted-media';
    container.appendChild(iframe);
  }
}
