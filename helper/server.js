const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
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
  if (!url && type !== 'clear') return res.status(400).json({ success: false });

  console.log(`\n[Yeni İstek] Tür: ${type} | Veri: ${url || 'Boş'}`);
  
  let obsUpdated = false;
  
  if (type === 'webrtc') {
    obsUpdated = await obs.updateOverlaySource('webrtc.html');
  } 
  else if (type === 'stop_webrtc' || type === 'clear') {
    // Ekranda kalan eski resmi de siliyoruz
    mediaStore.setMedia('clear', '');
    
    // OBS'i index.html sayfasına (boş halde) geri döndür
    obsUpdated = await obs.updateOverlaySource('index.html');
    
    // Overlay sayfasına "Ekranı Temizle" sinyali gönder
    wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: 'media_update', media: { type: 'clear', url: '' } }));
      }
    });
  }
  else {
    const savedMedia = mediaStore.setMedia(type, url);
    obsUpdated = await obs.updateOverlaySource('index.html');
    
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
