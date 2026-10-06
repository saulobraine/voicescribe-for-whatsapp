(() => {
  // Mapa de blobs ativos para acesso do content script
  window.__wgtBlobStore = window.__wgtBlobStore || new Map();
  const blobStore = window.__wgtBlobStore;

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
    const { requestId, url } = event.detail || {};
    try {
      let blob = url ? blobStore.get(url) : null;

      // Se não encontrou no mapa mas tem URL, tenta fetch no contexto da página
      if (!blob && url) {
        try {
          const res = await fetch(url);
          if (res.ok) blob = await res.blob();
        } catch {}
      }

      // Se ainda não encontrou e temos blobs no store, tenta o mais recente
      if (!blob && blobStore.size > 0) {
        const allBlobs = Array.from(blobStore.values());
        blob = allBlobs[allBlobs.length - 1];
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
      blobStore.set(url, object);
      // Evita acúmulo excessivo em memória mantendo os últimos 50
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