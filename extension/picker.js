(function() {
  if (window.__obsPickerActive) return;
  window.__obsPickerActive = true;

  console.log("OBS Helper: Seçici (picker) başlatıldı. Canlı yansıtmak için bir VİDEO alanını seçin.");

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
  let pc = null; // PeerConnection

  function onMouseMove(e) {
    if (currentTarget) currentTarget.classList.remove('obs-helper-highlight');
    currentTarget = e.target;
    currentTarget.classList.add('obs-helper-highlight');
  }

  async function onClick(e) {
    e.preventDefault(); 
    e.stopPropagation(); 

    if (currentTarget) currentTarget.classList.remove('obs-helper-highlight');

    // Tıklanan yerdeki elementleri al
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
       console.log("Video bulundu, canlı yayın (WebRTC) başlatılıyor...");
       stopPicker();
       startLiveStream(foundMedia);
    } else if (foundMedia && foundMedia.tagName === 'IMG') {
       console.log("Resim bulundu, doğrudan aktarılıyor...");
       stopPicker();
       sendToHelper('image', foundMedia.src);
    } else {
       alert("OBS Helper: Bu alanda doğrudan yakalanabilecek bir video bulunamadı.");
       stopPicker();
    }
  }

  // --- WEBRTC CANLI YAYIN MANTIĞI ---
  async function startLiveStream(videoElement) {
    // 1. Arka plana yayına başladığımızı haber veriyoruz
    chrome.runtime.sendMessage({ type: 'start_webrtc' });

    let stream;
    try {
      // 2. Videonun tam O ANKİ canlı akışını alıyoruz (sesiyle birlikte)
      stream = videoElement.captureStream ? videoElement.captureStream() : videoElement.mozCaptureStream();
    } catch (err) {
      alert("Bu video DRM/Güvenlik ayarları nedeniyle doğrudan canlı yansıtılamıyor.");
      return;
    }

    // 3. WebRTC Bağlantısını Kuruyoruz (Google'ın ücretsiz STUN sunucusu)
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

    // Yayınlanacak izleri (ses + görüntü) bağlantıya ekle
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Aday (ICE) üretildikçe bunu OBS'e iletmek üzere arka plana gönder
    pc.onicecandidate = e => {
      if (e.candidate) {
         chrome.runtime.sendMessage({ type: 'webrtc_signal', data: { candidate: e.candidate } });
      }
    };

    // Teklifi (Offer) oluştur ve OBS'e yolla
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    chrome.runtime.sendMessage({ type: 'webrtc_signal', data: { sdp: offer } });

    // Sayfaya küçük bir "Canlı Yayında" etiketi ekle
    showLiveIndicator();
  }

  // 4. OBS'ten gelen cevapları (Answer) yakala ve işle
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === 'webrtc_signal' && pc) {
       try {
         if (msg.data.sdp) {
           await pc.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
         } else if (msg.data.candidate) {
           await pc.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
         }
       } catch (err) {
         console.error("WebRTC Sinyal Hatası:", err);
       }
    }
  });

  function sendToHelper(type, url) {
    chrome.storage.sync.get({ helperUrl: 'http://localhost:3000' }, (data) => {
      fetch(`${data.helperUrl}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url })
      });
    });
  }

  function showLiveIndicator() {
    const div = document.createElement('div');
    div.innerHTML = "OBS Canlı Yayında (Tıklanan Video Yansıtılıyor)";
    div.style = "position: fixed; top: 10px; right: 10px; background: rgba(255,0,0,0.8); color: white; padding: 10px; border-radius: 5px; z-index: 999999; font-weight: bold;";
    document.body.appendChild(div);
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
