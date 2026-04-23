(function() {
  if (window.__obsPickerActive) return;
  window.__obsPickerActive = true;

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
      if (el.tagName === 'VIDEO' || el.tagName === 'IMG') { foundMedia = el; break; }
    }
    if (!foundMedia && currentTarget) {
      foundMedia = currentTarget.querySelector('video') || currentTarget.querySelector('img');
    }

    if (foundMedia && foundMedia.tagName === 'VIDEO') {
       stopPicker();
       startLiveStream(foundMedia);
    } else if (foundMedia && foundMedia.tagName === 'IMG') {
       stopPicker();
       chrome.runtime.sendMessage({ type: 'set_state', state: 'idle' });
       sendToHelper('image', foundMedia.src);
    } else {
       stopPicker();
       chrome.runtime.sendMessage({ type: 'set_state', state: 'idle' });
    }
  }

  // 1. ADIM: OBS'i Uyandır
  function startLiveStream(videoElement) {
    pendingVideoElement = videoElement;
    chrome.runtime.sendMessage({ type: 'start_webrtc' });
  }

  // 2. ADIM: Görüntüyü Aktar
  async function establishWebRTC() {
    if (!pendingVideoElement) return;

    let stream;
    try {
      stream = pendingVideoElement.captureStream ? pendingVideoElement.captureStream() : pendingVideoElement.mozCaptureStream();
    } catch (err) {
      alert("Bu video DRM nedeniyle yansıtılamıyor.");
      forceStopStream();
      return;
    }

    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = e => {
      if (e.candidate) chrome.runtime.sendMessage({ type: 'webrtc_signal', data: { candidate: e.candidate } });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc && pc.iceConnectionState === 'connected') {
        // Görüntü bağlandığında eklenti kutusunda "Canlı Yayında" yazdırt
        chrome.runtime.sendMessage({ type: 'set_state', state: 'live' });
      }
      else if (pc && (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')) {
        forceStopStream();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    chrome.runtime.sendMessage({ type: 'webrtc_signal', data: { sdp: offer } });
  }

  // Arka plandan veya Popup'tan gelen zorla durdurma vs. komutları dinliyoruz
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === 'force_stop') {
       forceStopStream();
    }
    else if (msg.type === 'webrtc_signal') {
       try {
         if (msg.data.type === 'receiver_ready') {
            if (!pc && pendingVideoElement) await establishWebRTC();
         } else if (pc) {
           if (msg.data.sdp) await pc.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
           else if (msg.data.candidate) await pc.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
         }
       } catch (err) { }
    }
  });

  window.addEventListener('beforeunload', () => { if (pc) forceStopStream(); });

  function sendToHelper(type, url) {
    chrome.storage.sync.get({ helperUrl: 'http://localhost:3000' }, (data) => {
      fetch(`${data.helperUrl}/media`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, url })
      }).catch(()=>{});
    });
  }

  function forceStopStream() {
    stopPicker();
    if (pc) {
      pc.close();
      pc = null;
    }
    pendingVideoElement = null;
    chrome.runtime.sendMessage({ type: 'set_state', state: 'idle' });
    sendToHelper('stop_webrtc', 'durduruldu');
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
