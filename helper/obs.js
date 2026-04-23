const { default: OBSWebSocket } = require('obs-websocket-js');
const config = require('./config');

const obs = new OBSWebSocket();
let isConnected = false;

async function connect() {
  try {
    const { obsWebSocketVersion } = await obs.connect(config.OBS_WS_URL, config.OBS_WS_PASSWORD);
    isConnected = true;
    console.log(`[OBS] Bağlantı başarılı!`);
  } catch (error) {
    isConnected = false;
  }
}

obs.on('ConnectionClosed', () => { isConnected = false; });

async function updateOverlaySource(pageName = 'index.html') {
  if (!isConnected) {
    await connect();
    if (!isConnected) return false;
  }

  try {
    const overlayUrl = `http://localhost:${config.PORT}/overlay/${pageName}`;
    const customCss = "body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }";

    await obs.call('SetInputSettings', {
      inputName: config.OBS_TARGET_SOURCE,
      inputSettings: {
        url: overlayUrl,
        css: customCss
      }
    });
    
    console.log(`[OBS] Kaynak yönlendirildi: ${pageName}`);
    return true;
  } catch (error) {
    console.error('[OBS] Hata:', error.message);
    return false;
  }
}

module.exports = { connect, updateOverlaySource };
