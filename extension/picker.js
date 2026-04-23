(function() {
  if (window.__obsPickerActive) return;
  window.__obsPickerActive = true;

  console.log("OBS Helper: Seçici (picker) başlatıldı.");

  const highlightStyle = document.createElement('style');
  highlightStyle.id = 'obs-helper-highlight-style';
  highlightStyle.innerHTML = `
    .obs-helper-highlight {
      outline: 4px dashed #ff0000 !important;
      background-color: rgba(255, 0, 0, 0.3) !important;
      cursor: crosshair !important;
    }
  `;
  document.head.appendChild(highlightStyle);

  let currentTarget = null;
  let pc = null;
  let pendingVideoElement = null;

  function onMouseMove(e) {
    if (currentTarget) currentTarget.classList.remove('obs-helper-highlight');
    currentTarget = e.target;
    currentTarget.classList.add('obs-helper-highlight');
  }

  async function onClick(e) {
    e.preventDefault(); 
    e.stopPropagation(); 

    if (currentTarget) currentTarget.classList.remove('obs-helper-highlight');

    const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
    let foundMedia = null;
    
    for (const el of elementsUnderCursor) {
      if (el.tagName === 'VIDEO' || el.tagName === 'IMG') {
        foundMedia = el;
        break;
      }
    }
    if (!foundMedia && currentTarget) {
      foundMedia = currentTarget.querySelector('video') || currentTarget.querySelector('img');
    }

    if (foundMedia && foundMedia.tagName === 'VIDEO') {
       console.log("Video bulundu, OBS'in hazırlanması bekleniyor...");
       stopPicker();
       startLiveStream(foundMedia);
    } else if (foundMedia && foundMedia.tagName === 'IMG') {
       stopPicker();
       sendToHelper('image', foundMedia.src);
    } else {
       alert("OBS Helper: Bu alanda doğrudan yakalanabilecek bir video bulunamadı.");
       stopPicker();
    }
  }

  // 1. ADIM: Sadece bağlanma sinyalini yolla ve Bekleme ekranını göster
  function startLiveStream(videoElement) {
    pendingVideoElement = videoElement;
    chrome.runtime.sendMessage({ type: 'start_webrtc' });
    showLiveIndicator(true);
  }

  // 2. ADIM: OBS'den "Ben Hazırım" sinyali geldiğinde Asıl Yayını Başlat
  async function establishWebRTC() {
    if (!pendingVideoElement) return;

    let stream;
    try {
      stream = pendingVideoElement.captureStream ? pendingVideoElement.captureStream() : pendingVideoElement.mozCaptureStream();
    } catch (err) {
      alert("Bu video DRM/Güvenlik ayarları nedeniyle doğrudan canlı yansıtılamıyor.");
      forceStopStream();
      return;
    }

    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = e => {
      if (e.candidate) {
         chrome.runtime.sendMessage({ type: 'webrtc_signal', data: { candidate: e.candidate } });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
        forceStopStream();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    chrome.runtime.sendMessage({ type: 'webrtc_signal', data: { sdp: offer } });

    updateLiveIndicatorText("OBS Canlı Yayında");
  }

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === 'webrtc_signal') {
       try {
         // Eğer OBS'den "Ben Yayını Almaya Hazırım" sinyali geldiyse ve henüz yayın başlatılmadıysa
         if (msg.data.type === 'receiver_ready') {
            if (!pc && pendingVideoElement) {
               console.log("OBS Hazır. WebRTC Görüntü Aktarımı Başlıyor!");
               await establishWebRTC();
            }
         } else if (pc) {
           if (msg.data.sdp) {
             await pc.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
           } else if (msg.data.candidate) {
             await pc.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
           }
         }
       } catch (err) {
         console.error("WebRTC Sinyal Hatası:", err);
       }
    }
  });

  window.addEventListener('beforeunload', () => {
    if (pc) forceStopStream();
  });

  function sendToHelper(type, url) {
    chrome.storage.sync.get({ helperUrl: 'http://localhost:3000' }, (data) => {
      fetch(`${data.helperUrl}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url })
      }).catch(()=>{});
    });
  }

  function showLiveIndicator(isConnecting = false) {
    const div = document.createElement('div');
    div.id = 'obs-helper-live-panel';
    const text = isConnecting ? "OBS'e Bağlanılıyor..." : "OBS Canlı Yayında";
    const dotColor = isConnecting ? "yellow" : "white";
    
    div.innerHTML = `
      <div style="display:flex; align-items:center; gap: 10px;">
         <div id="obs-indicator-dot" style="width: 10px; height: 10px; background: ${dotColor}; border-radius: 50%; animation: pulse 1s infinite;"></div>
         <span id="obs-indicator-text">${text}</span>
         <button id="obs-helper-stop-btn" style="padding: 5px 10px; cursor: pointer; border: none; background: white; color: red; border-radius: 3px; font-weight: bold;">Yayını Durdur</button>
      </div>
      <style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }</style>
    `;
    div.style = "position: fixed; top: 10px; right: 10px; background: rgba(255,0,0,0.8); color: white; padding: 10px; border-radius: 5px; z-index: 999999; font-family: sans-serif;";
    document.body.appendChild(div);

    document.getElementById('obs-helper-stop-btn').addEventListener('click', () => {
       forceStopStream();
    });
  }

  function updateLiveIndicatorText(text) {
    const span = document.getElementById('obs-indicator-text');
    const dot = document.getElementById('obs-indicator-dot');
    if (span) span.innerText = text;
    if (dot) dot.style.background = 'white';
  }

  function forceStopStream() {
    if (pc) {
      pc.close();
      pc = null;
    }
    pendingVideoElement = null;
    const panel = document.getElementById('obs-helper-live-panel');
    if (panel) panel.remove();

    sendToHelper('stop_webrtc', 'durduruldu');
    console.log("OBS Yayını Durduruldu.");
  }

  function stopPicker() {
    window.__obsPickerActive = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onClick, true); 
    const styleEl = document.getElementById('obs-helper-highlight-style');
    if (styleEl) styleEl.remove();
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('click', onClick, true); 
})();
