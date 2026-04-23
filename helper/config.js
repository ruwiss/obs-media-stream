require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  OBS_WS_URL: process.env.OBS_WS_URL || 'ws://127.0.0.1:4455',
  OBS_WS_PASSWORD: process.env.OBS_WS_PASSWORD || '',
  OBS_TARGET_SCENE: process.env.OBS_TARGET_SCENE || 'Sahne',
  OBS_TARGET_SOURCE: process.env.OBS_TARGET_SOURCE || 'HelperImage'
};
