// Seçilen medyayı bellekte (memory) tutuyoruz.
// İleride tarayıcı overlay'i için verileri (son gösterilen video/resim) buradan çekeceğiz.
let currentMedia = {
  type: null,
  url: null,
  timestamp: null
};

function setMedia(type, url) {
  currentMedia = {
    type,
    url,
    timestamp: Date.now()
  };
  return currentMedia;
}

function getMedia() {
  return currentMedia;
}

module.exports = {
  setMedia,
  getMedia
};
