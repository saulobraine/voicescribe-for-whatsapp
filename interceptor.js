(() => {
  // Mapa de blobs ativos para acesso do content script
  window.__wgtBlobStore = window.__wgtBlobStore || new Map();
  const blobStore = window.__wgtBlobStore;

  let isSilentCaptureActive = false;
  let silentCaptureTimer = null;

  window.addEventListener('wgt-silent-capture-start', () => {
    isSilentCaptureActive = true;
    // Rede de segurança: se o stop se perder, a captura expira sozinha
    clearTimeout(silentCaptureTimer);
    silentCaptureTimer = setTimeout(() => { isSilentCaptureActive = false; }, 30000);
    document.querySelectorAll('audio, video').forEach(el => {
      try {
        el.muted = true;
        el.volume = 0;
      } catch {}
    });
  });

  window.addEventListener('wgt-silent-capture-stop', () => {
    isSilentCaptureActive = false;
    clearTimeout(silentCaptureTimer);
    // Restaura volume de todos os elementos mutados, sem forçar pause
    // (a pausa correta é feita pelo content.js via botão do próprio WhatsApp)
    document.querySelectorAll('audio, video').forEach(el => {
      try {
        if (el.paused) {
          // Elemento já parado: apenas restaura volume
          el.muted = false;
          el.volume = 1;
        } else {
          // Elemento ainda tocando (caso raro): pausa e restaura
          el.pause();
          el.currentTime = 0;
          setTimeout(() => {
            try {
              el.muted = false;
              el.volume = 1;
            } catch {}
          }, 300);
        }
      } catch {}
    });
  });

  const isAudioOrVideo = (type) => {
    if (!type || typeof type !== 'string') return true;
    return type.startsWith('audio/') || type.startsWith('video/') || type.includes('ogg') || type.includes('opus') || type.includes('octet-stream');
  };

  const emit = (url, type = '') => {
    if (!url || typeof url !== 'string') return;
    if (url.includes('telemetry') || url.includes('dit.whatsapp.net') || url.includes('image')) return;

    const lower = url.toLowerCase();
    const interesting =
      lower.includes('mmg.whatsapp.net') ||
      /\.(ogg|opus|mp4)(?:[?#]|$)/i.test(lower) ||
      lower.includes('/media/') ||
      isAudioOrVideo(type);

    if (interesting) {
      window.dispatchEvent(new CustomEvent('wgt-audio', {
        detail: { url, type, timestamp: Date.now() }
      }));
    }
  };

  // Responde a solicitações de conversão de áudio vindas do content script
  window.addEventListener('wgt-request-audio', async (event) => {
    const { requestId, url, minTimestamp } = event.detail || {};
    try {
      let blob = null;

      // 1. Se informou URL, tenta obter diretamente do cache ou fetch
      if (url) {
        blob = blobStore.get(url);
        if (!blob) {
          try {
            const res = await fetch(url);
            if (res.ok) blob = await res.blob();
          } catch {}
        }
      }

      // 2. Se informou minTimestamp, busca o blob mais recente criado a partir do início da captura
      if (!blob && minTimestamp) {
        let bestBlob = null;
        let bestTime = 0;
        for (const [, bObj] of blobStore.entries()) {
          if (bObj && bObj.__wgtTimestamp >= minTimestamp) {
            if (bObj.__wgtTimestamp >= bestTime) {
              bestBlob = bObj;
              bestTime = bObj.__wgtTimestamp;
            }
          }
        }
        if (bestBlob) {
          blob = bestBlob;
        }
      }

      // 3. Fallback: apenas se não houver restrição de tempo, verifica elementos de mídia no DOM
      if (!blob && !minTimestamp) {
        const audioElements = Array.from(document.querySelectorAll('audio, video')).filter(el => el.currentSrc || el.src);
        for (const el of audioElements) {
          const aUrl = el.currentSrc || el.src;
          if (aUrl) {
            blob = blobStore.get(aUrl);
            if (!blob) {
              try {
                const res = await fetch(aUrl);
                if (res.ok) {
                  blob = await res.blob();
                  break;
                }
              } catch {}
            } else {
              break;
            }
          }
        }
      }

      if (!blob) {
        window.dispatchEvent(new CustomEvent('wgt-response-audio', {
          detail: { requestId, error: 'Áudio não encontrado no contexto da página.' }
        }));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        window.dispatchEvent(new CustomEvent('wgt-response-audio', {
          detail: { requestId, dataUrl: reader.result }
        }));
      };
      reader.onerror = () => {
        window.dispatchEvent(new CustomEvent('wgt-response-audio', {
          detail: { requestId, error: 'Falha ao ler dados do áudio.' }
        }));
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('wgt-response-audio', {
        detail: { requestId, error: err.message || String(err) }
      }));
    }
  });

  if (window.__wgtInterceptorInstalled) return;
  window.__wgtInterceptorInstalled = true;

  // Intercepta reprodução de áudio: captura URL do áudio no play e silencia se captura ativa
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    const audioUrl = this.currentSrc || this.src;
    if (audioUrl) {
      window.dispatchEvent(new CustomEvent('wgt-audio', {
        detail: { url: audioUrl, timestamp: Date.now() }
      }));
    }
    if (isSilentCaptureActive) {
      try {
        this.muted = true;
        this.volume = 0;
      } catch {}
    } else if (this.muted && this.volume === 0) {
      // Toque manual fora da captura: nunca fica mudo
      try {
        this.muted = false;
        this.volume = 1;
      } catch {}
    }
    return originalPlay.apply(this, arguments);
  };

  // Garante que novos elementos de áudio inseridos durante a captura silenciosa comecem mutados
  const mediaObserver = new MutationObserver(() => {
    if (isSilentCaptureActive) {
      document.querySelectorAll('audio, video').forEach(el => {
        try {
          el.muted = true;
          el.volume = 0;
        } catch {}
      });
    }
  });
  mediaObserver.observe(document.documentElement, { childList: true, subtree: true });

  const originalFetch = window.fetch;
  window.fetch = function(resource, init) {
    try {
      const url = typeof resource === 'string' ? resource : resource?.url;
      emit(url);
    } catch {}
    return originalFetch.apply(this, arguments);
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__wgtUrl = url;
    return xhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', () => {
      try {
        emit(this.__wgtUrl, this.getResponseHeader('Content-Type') || '');
      } catch {}
    });
    return xhrSend.apply(this, arguments);
  };

  const createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(object) {
    const url = createObjectURL(object);
    if (object instanceof Blob && isAudioOrVideo(object.type)) {
      object.__wgtTimestamp = Date.now();
      blobStore.set(url, object);
      if (blobStore.size > 50) {
        const oldestKey = blobStore.keys().next().value;
        blobStore.delete(oldestKey);
      }
    }
    try {
      emit(url, object?.type || '');
    } catch {}
    return url;
  };

  // Mantém blobs por pelo menos 2 minutos mesmo após revoke
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function(url) {
    setTimeout(() => {
      blobStore.delete(url);
    }, 120000);
    return revokeObjectURL(url);
  };
})();