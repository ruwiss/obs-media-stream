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
app.use('/overlay', express.static(path.join(__dirname, '../overlay')));

obs.connect();

app.post('/media', async (req, res) => {
  const { type, url } = req.body;
  if (!url) return res.status(400).json({ success: false });

  console.log(`\n[Yeni İstek] Tür: ${type} | Veri: ${url}`);
  
  // Canlı yayın başlatıldığında değil, "RESİM/VİDEO" seçildiğinde ekrana yansıtması için
  let obsUpdated = false;
  
  if (type === 'webrtc') {
    obsUpdated = await obs.updateOverlaySource('webrtc.html');
  } 
  else if (type === 'stop_webrtc') {
    // Yayın durdurulduğunda siyah ekran yerine eski resim/video ekranına (index.html) dönsün
    obsUpdated = await obs.updateOverlaySource('index.html');
  }
  else {
    const savedMedia = mediaStore.setMedia(type, url);
    obsUpdated = await obs.updateOverlaySource('index.html');
    
    // Resim/Video güncellemelerini overlay.js sayfasına bildir
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'media_update', media: savedMedia }));
      }
    });
  }
  
  res.json({ success: true, obsUpdated });
});

app.get('/current', (req, res) => {
  res.json({ success: true, media: mediaStore.getMedia() });
});

// WEBSOCKET: Chrome Eklentisi ile OBS arasında canlı WebRTC sinyal köprüsü
wss.on('connection', ws => {
  ws.on('message', message => {
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
  console.log(` WebRTC Sunucusu Aktif: ws://localhost:${config.PORT}`);
  console.log('--------------------------------------------------');
});
