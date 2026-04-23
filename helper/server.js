const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const obs = require('./obs');
const mediaStore = require('./media-store');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(cors());

// Overlay dosyalarını aç
app.use('/overlay', express.static(path.join(__dirname, '../overlay')));

// OBS bağlantısı
obs.connect();

app.post('/media', async (req, res) => {
  const { type, url } = req.body;
  if (!url) return res.status(400).json({ success: false });

  console.log(`\n[Yeni İstek] Tür: ${type} | Veri: ${url}`);
  mediaStore.setMedia(type, url);

  // Gelen isteğe göre OBS'in kaynağını (Sayfasını) güncelle
  // 'webrtc' canlı yayın isteği gelirse webrtc.html'e yönlendiriyoruz
  let page = 'index.html';
  if (type === 'webrtc') {
    page = 'webrtc.html';
  }
  
  const obsUpdated = await obs.updateOverlaySource(page);
  
  res.json({ success: true, obsUpdated });
});

// WEBSOCKET: Chrome Eklentisi ile OBS arasında canlı WebRTC sinyal köprüsü
wss.on('connection', ws => {
  ws.on('message', message => {
    // Gelen mesajı bağlantı kuran DİĞER herkese yolla (Eklenti -> OBS | OBS -> Eklenti)
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === 1) {
         client.send(message.toString());
      }
    });
  });
});

server.listen(config.PORT, () => {
  console.log('--------------------------------------------------');
  console.log(` Yardımcı Servis Başlatıldı! (Port: ${config.PORT})`);
  console.log(` WebRTC Sinyal Sunucusu Aktif: ws://localhost:${config.PORT}`);
  console.log('--------------------------------------------------');
});
