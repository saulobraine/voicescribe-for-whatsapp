(() => {
  if (window.top !== window) return;

  const BUTTON = 'wgt-transcribe-button';
  const STYLE = 'wgt-style';
  let lastAudio = null;
  let lastAudioAt = 0;
  let activeBubble = null;

  injectInterceptor();

  let lastAudioBlob = null;
  let lastAudioBlobAt = 0;

  window.addEventListener('wgt-audio', event => {
    const detail = event.detail || {};
    if (!detail.url) return;
    // Store blob directly for immediate access
    if (detail.blob instanceof Blob) {
      lastAudioBlob = detail.blob;
      lastAudioBlobAt = Date.now();
    }
    lastAudio = detail.url;
    lastAudioAt = Date.now();
  });

  injectStyles();
  void cleanupLegacyCache();
  void scan();

  const observer = new MutationObserver(mutations => {
    const isInternalMutation = mutations.every(mutation => {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (nodes.length === 0) return true;
      return nodes.every(node => {
        if (node.nodeType !== 1) return true;
        return node.classList?.contains(BUTTON) ||
               node.classList?.contains('wgt-cached-container') ||
               node.classList?.contains('wgt-bubble') ||
               node.querySelector?.(`.${BUTTON}, .wgt-cached-container, .wgt-bubble`);
      });
    });
    if (isInternalMutation) return;

    clearTimeout(scan.timer);
    scan.timer = setTimeout(() => void scan(), 300);
  });

  const startObserver = () => {
    const main = document.querySelector('#main') || document.body;
    if (main) observer.observe(main, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  function injectInterceptor() {
    if (document.getElementById('wgt-interceptor')) return;
    const script = document.createElement('script');
    script.id = 'wgt-interceptor';
    script.src = chrome.runtime.getURL('interceptor.js');
    (document.head || document.documentElement).appendChild(script);
  }

  function injectStyles() {
    if (document.getElementById(STYLE)) return;
    const style = document.createElement('style');
    style.id = STYLE;
    style.textContent = `
      .${BUTTON} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 6px 0 0 8px !important;
        margin-inline: calc(var(--x53dyk0) + 10px) !important;
        padding: 4px 10px !important;
        border: 0 !important;
        border-radius: 12px !important;
        background: #00a884 !important;
        color: #fff !important;
        font: 600 11px/1.2 system-ui,sans-serif !important;
        cursor: pointer !important;
        z-index: 9999 !important;
        min-height: 24px !important;
      }
      .${BUTTON}:disabled { opacity: .6 !important; cursor: wait !important; }
      .wgt-bubble {
        position: relative !important;
        margin: 6px 0 0 12px !important;
        margin-inline: calc(var(--x53dyk0) + 10px) !important;
        padding: 10px 14px !important;
        padding-inline-end: var(--x53dyk0, 14px) !important;
        border-radius: 8px !important;
        background: #f0f2f5 !important;
        color: #111b21 !important;
        font: 13px/1.4 system-ui,sans-serif !important;
        line-height: 1.4 !important;
        white-space: pre-wrap !important;
        max-width: 360px !important;
        box-sizing: border-box !important;
        display: inline-block !important;
        vertical-align: top !important;
      }
      .wgt-close {
        position: absolute !important;
        right: 8px !important;
        top: 6px !important;
        border: 0 !important;
        background: transparent !important;
        color: #667781 !important;
        font-size: 18px !important;
        cursor: pointer !important;
        width: 20px !important;
        height: 20px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .wgt-copy {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin-top: 8px !important;
        border: 0 !important;
        border-radius: 5px !important;
        padding: 4px 8px !important;
        background: #d9fdd3 !important;
        color: #111b21 !important;
        font: 600 12px/1 system-ui,sans-serif !important;
        cursor: pointer !important;
      }
      .wgt-cached-container {
        display: block !important;
        width: 100% !important;
        clear: both !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function findMessage(el) {
    return el.closest?.('[data-id], [role="row"], .message-in, .message-out, .msg-container');
  }

  function findMedia(message) {
    if (!message) return null;
    const media = [...message.querySelectorAll('audio,video')]
      .find(x => x.currentSrc || x.src);
    return media || null;
  }

  async function scan() {
    const candidates = document.querySelectorAll(
      'audio, video, [data-testid*="audio"], [data-testid*="ptt"], [data-testid*="voice"], [data-icon*="audio-play"], [data-icon*="ptt"], span.ptt-status'
    );

    const seen = new Set();
    for (const target of candidates) {
      const message = findMessage(target);
      if (!message || seen.has(message) || message.querySelector(`.${BUTTON}`) || message.dataset.wgtProcessed) continue;
      
      seen.add(message);
      message.dataset.wgtProcessed = 'true';
      
      const button = addButton(message, target);
      void checkMessageCache(message, button);
    }
  }

  async function checkMessageCache(message, button) {
    try {
      const cached = await getCachedTranscript(message);
      if (!cached) return;

      if (button && button.isConnected) {
        button.textContent = '✓ Cache';
        button.title = 'Transcrição em cache (clique para alternar)';
      }

      if (!message.querySelector('.wgt-cached-container') && !message.dataset.wgtClosed) {
        showCachedBubble(message, cached);
      }
    } catch (e) {
      console.warn('[WGT] Erro ao carregar cache da mensagem:', e);
    }
  }

  function showCachedBubble(message, text) {
    if (message.querySelector('.wgt-cached-container')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'wgt-cached-container';
    
    const bubble = document.createElement('div');
    bubble.className = 'wgt-bubble';

    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'wgt-copy';
    copyBtn.textContent = 'Copiar';
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => {
        if (copyBtn.isConnected) copyBtn.textContent = 'Copiar';
      }, 1200);
    });
    bubble.appendChild(copyBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'wgt-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Fechar';
    closeBtn.addEventListener('click', () => {
      wrapper.remove();
      message.dataset.wgtClosed = 'true';
    });
    bubble.appendChild(closeBtn);
    
    wrapper.appendChild(bubble);
    message.appendChild(wrapper);
  }

  function addButton(message, target) {
    const button = document.createElement('button');
    button.className = BUTTON;
    button.type = 'button';
    button.textContent = '🎙 Transcrever';
    button.title = 'Transcrever áudio com Gemini';

    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;

      // 1. Verifica cache antes de qualquer download/reprodução de áudio
      const cached = await getCachedTranscript(message);
      if (cached) {
        button.textContent = '✓ Cache';
        const existing = message.querySelector('.wgt-cached-container');
        if (existing) {
          existing.remove();
          message.dataset.wgtClosed = 'true';
        } else {
          delete message.dataset.wgtClosed;
          showCachedBubble(message, cached);
        }
        return;
      }

      button.disabled = true;
      button.textContent = '⏳ Transcrevendo...';
      closeBubble();

      try {
        // Verifica se estamos em período de cooldown de quota
        const cooldown = await getQuotaCooldown();
        if (cooldown) {
          const now = Date.now();
          if (now < cooldown.until) {
            const releaseDate = new Date(cooldown.until);
            const timeStr = releaseDate.toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            
            button.textContent = '🕐 Cooldown';
            showBubble(button, `Limite de requisições da API Gemini atingido!\n\n📅 Pode usar novamente: ${timeStr}`, false);
            setTimeout(() => {
              if (button.isConnected) {
                button.disabled = false;
                button.textContent = '🎙 Transcrever';
              }
            }, 3000);
            return;
          }
        }

        const dataUrl = await obtainAudio(message, target);
        const result = await sendForTranscription(dataUrl, message);
        button.textContent = '✓ Transcrito';
        await cacheTranscript(message, result); // Salva no cache
        delete message.dataset.wgtClosed;
        showCachedBubble(message, result);
      } catch (error) {
        // A cota do Gemini sendo atingida é um comportamento normal, tratamos separadamente
        if (error.message.includes('quota') || error.message.includes('rate limit')) {
          const retryMatch = error.message.match(/retry in (\d+)h(\d+)m(?:(\d+)\.\d+s)?/);
          if (retryMatch) {
            const hours = parseInt(retryMatch[1]);
            const minutes = parseInt(retryMatch[2]);
            const seconds = parseInt(retryMatch[3] || 0);
            const until = Date.now() + (hours * 3600000) + (minutes * 60000) + (seconds * 1000);
            await setQuotaCooldown(until);
            
            button.textContent = '🕐 Cooldown';
            const date = new Date(until);
            const retryStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            showBubble(button, `Limite de requisições da API Gemini atingido!\n\n📅 Pode usar novamente: ${retryStr}`, false);
            setTimeout(() => {
              if (button.isConnected) {
                button.disabled = false;
                button.textContent = '🎙 Transcrever';
              }
            }, 3000);
            return;
          }
        }

        // Outros erros são tratados normalmente
        console.error('[WGT]', error);
        button.textContent = '✕ Erro';
        showBubble(button, error.message || 'Falha na transcrição.', true);
      } finally {
        setTimeout(() => {
          if (button.isConnected && !button.textContent.includes('Cooldown')) {
            button.disabled = false;
            getCachedTranscript(message).then(hasCache => {
              if (button.isConnected) {
                button.textContent = hasCache ? '✓ Cache' : '🎙 Transcrever';
              }
            }).catch(() => {});
          }
        }, 2500);
      }
    });

    const player = target.closest?.('[data-testid="audio-player-wrapper"], [data-testid="ptt-player-wrapper"]') || target;
    if (player?.parentNode === message) player.after(button);
    else {
      const appendAnchor = message.querySelector('.selectable-text, .chat-msg-symbol') || message;
      appendAnchor.appendChild(button);
    }

    return button;
  }

  function requestAudioFromPage(url) {
    return new Promise((resolve, reject) => {
      const requestId = 'wgt_' + Math.random().toString(36).slice(2, 9);
      const timer = setTimeout(() => {
        window.removeEventListener('wgt-response-audio', handler);
        reject(new Error('Tempo limite excedido ao capturar o áudio da página.'));
      }, 7000);

      function handler(event) {
        const detail = event.detail || {};
        if (detail.requestId !== requestId) return;
        window.removeEventListener('wgt-response-audio', handler);
        clearTimeout(timer);

        if (detail.error) {
          reject(new Error(detail.error));
        } else if (detail.dataUrl) {
          resolve(detail.dataUrl);
        } else {
          reject(new Error('Áudio vazio retornado pela página.'));
        }
      }

      window.addEventListener('wgt-response-audio', handler);
      window.dispatchEvent(new CustomEvent('wgt-request-audio', {
        detail: { requestId, url }
      }));
    });
  }

  async function obtainAudio(message, target) {
    let media = target.matches?.('audio,video') ? target : findMedia(message);
    let url = media?.currentSrc || media?.src || null;

    // 1. Se a tag de mídia já possui URL (áudio já carregado pelo WhatsApp)
    if (url) {
      if (!url.startsWith('blob:')) {
        try {
          return await fetchAsDataUrl(url);
        } catch {}
      }
      try {
        const dataUrl = await requestAudioFromPage(url);
        if (dataUrl) return dataUrl;
      } catch (e) {
        console.warn('[WGT] Tentativa direta de conversão falhou:', e);
      }
    }

    // 2. Se a mídia ainda não foi carregada no DOM, dispara o Play do WhatsApp
    const play = message.querySelector(
      '[data-testid="audio-play"], [data-icon="audio-play"], [data-icon="audio-play-filled"], [aria-label*="Reproduzir"], [aria-label*="Play"]'
    );

    if (play) {
      play.click();
    }

    // 3. Aguarda o WhatsApp inicializar e carregar a mídia
    for (let i = 0; i < 24; i++) {
      await sleep(250);

      media = findMedia(message);
      url = media?.currentSrc || media?.src || null;

      if (url) {
        try { media.pause(); } catch {}
        try {
          const dataUrl = await requestAudioFromPage(url);
          if (dataUrl) return dataUrl;
        } catch {}
      }
    }

    // 4. Última tentativa: solicita o áudio mais recente capturado pelo interceptor
    try {
      const fallbackDataUrl = await requestAudioFromPage(null);
      if (fallbackDataUrl) return fallbackDataUrl;
    } catch {}

    throw new Error('Não consegui obter o arquivo de áudio. Reproduza a mensagem e tente novamente.');
  }

  async function fetchAsDataUrl(url) {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`Não foi possível baixar o áudio (${response.status}).`);
    return await blobToDataUrl(await response.blob());
  }

  async function blobUrlToDataUrl(url) {
    return await blobToDataUrl(await (await fetch(url)).blob());
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Falha ao ler o áudio.'));
      reader.readAsDataURL(blob);
    });
  }

  // Validação e identificação única da mensagem para cache
  function isSpecificMessageId(id) {
    if (!id || typeof id !== 'string') return false;
    // Ignora IDs genéricos de containers ou de chats inteiros
    if (['main', 'pane-side', 'chat-list', 'app'].includes(id)) return false;

    // Um ID de mensagem individual no WhatsApp Web tem o formato:
    // [true|false]_[remetente/chat]_[stanzaId]
    // Ex: false_551199999999@c.us_3EB0ABCD1234
    const parts = id.split('_');
    if (parts.length >= 3 && parts[parts.length - 1].length >= 4) {
      return true;
    }
    // Caso de IDs com 2 partes contendo @ e stanzaId de mensagem
    if (parts.length >= 2 && id.includes('@') && parts[parts.length - 1].length >= 6) {
      return true;
    }
    return false;
  }

  function getMessageId(message) {
    if (!message) return null;

    // 1. Procura por data-id específico de mensagem no próprio elemento ou em filhos
    const selfId = message.getAttribute?.('data-id') || message.dataset?.id;
    if (isSpecificMessageId(selfId)) return selfId;

    const childWithId = message.querySelector?.('[data-id*="_"]');
    const childId = childWithId?.getAttribute?.('data-id') || childWithId?.dataset?.id;
    if (isSpecificMessageId(childId)) return childId;

    // 2. Procura em ancestrais que contenham data-id de mensagem
    const ancestor = message.closest?.('[data-id*="_"]');
    const ancestorId = ancestor?.getAttribute?.('data-id') || ancestor?.dataset?.id;
    if (isSpecificMessageId(ancestorId)) return ancestorId;

    // 3. Fallback: cria fingerprint único baseado nos metadados do DOM da mensagem
    return getMessageFingerprint(message);
  }

  function getMessageFingerprint(message) {
    // Extrai o identificador ou nome da conversa no cabeçalho
    const chatHeader = document.querySelector('#main header [title], #main header [data-testid="conversation-info-header-chat-title"]');
    const chatTitle = chatHeader?.getAttribute?.('title') || chatHeader?.textContent?.trim() || 'chat';

    // Extrai timestamp e remetente de data-pre-plain-text (ex: "[14:35, 05/10/2026] Contato: ")
    const copyable = message.querySelector?.('[data-pre-plain-text]');
    const preText = copyable?.getAttribute?.('data-pre-plain-text') || '';

    // Extrai horário visível da mensagem se preText não existir
    const timeEl = message.querySelector?.('[data-testid="msg-meta"], [data-testid="msg-time"], .copyable-text');
    const timeText = preText || timeEl?.textContent?.trim() || '';

    // Extrai duração do áudio exibida no player (ex: "0:15", "1:22")
    const durationMatch = message.textContent?.match(/\b\d{1,2}:\d{2}\b/);
    const duration = durationMatch ? durationMatch[0] : '';

    // Direção da mensagem (enviada vs recebida)
    const isOut = message.classList?.contains('message-out') || message.closest?.('.message-out') || message.querySelector?.('.message-out');
    const direction = isOut ? 'out' : 'in';

    // Se temos informações suficientes para formar uma chave única
    if (timeText || duration) {
      return `${chatTitle}_${direction}_${timeText}_${duration}`;
    }

    return null;
  }

  function getMessageCacheKey(message) {
    const id = getMessageId(message);
    if (!id) return null;
    const sanitized = String(id).replace(/[^a-zA-Z0-9_@-]/g, '_');
    return `wgt_msg_cache_${sanitized}`;
  }

  async function getCachedTranscript(message) {
    if (!chrome.storage || !chrome.storage.local) return null;
    const key = getMessageCacheKey(message);
    if (!key) return null;
    const result = await chrome.storage.local.get([key]);
    return result[key]?.transcript || null;
  }

  async function cacheTranscript(message, transcript) {
    if (!chrome.storage || !chrome.storage.local) return;
    const key = getMessageCacheKey(message);
    if (!key) return;
    await chrome.storage.local.set({
      [key]: {
        transcript,
        timestamp: Date.now(),
        id: getMessageId(message)
      }
    });
  }

  // Remove chaves de cache legadas geradas com IDs genéricos do chat inteiro
  async function cleanupLegacyCache() {
    try {
      if (!chrome.storage || !chrome.storage.local) return;
      const all = await chrome.storage.local.get(null);
      const keysToRemove = [];
      for (const key of Object.keys(all)) {
        if (key.startsWith('wgt_msg_cache_')) {
          const rawId = key.replace('wgt_msg_cache_', '');
          if (!isSpecificMessageId(rawId) && !rawId.includes('_in_') && !rawId.includes('_out_')) {
            keysToRemove.push(key);
          }
        }
      }
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
      }
    } catch {}
  }

  // Gerenciamento de cooldown de quota (por API key)
  async function getQuotaCooldown() {
    if (!chrome.storage || !chrome.storage.local) return null;
    const { geminiKey } = await chrome.storage.local.get(['geminiKey']);
    const key = `wgt_quota_cooldown_${geminiKey || 'default'}`;
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  }

  async function setQuotaCooldown(until) {
    if (!chrome.storage || !chrome.storage.local) return;
    const { geminiKey } = await chrome.storage.local.get(['geminiKey']);
    const key = `wgt_quota_cooldown_${geminiKey || 'default'}`;
    await chrome.storage.local.set({ [key]: { until } });
  }

  function sendForTranscription(audioData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'transcribeAudio', audioData }, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.success) return reject(new Error(response?.error || 'Erro desconhecido.'));
        resolve(response.data);
      });
    });
  }

  function showBubble(button, text, error = false) {
    closeBubble();
    const bubble = document.createElement('div');
    bubble.className = 'wgt-bubble';
    if (error) bubble.style.background = '#ffe8e6';

    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    if (!error) {
      const copy = document.createElement('button');
      copy.className = 'wgt-copy';
      copy.textContent = 'Copiar';
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copiado!';
        setTimeout(() => copy.textContent = 'Copiar', 1200);
      });
      bubble.appendChild(copy);
    }

    const close = document.createElement('button');
    close.className = 'wgt-close';
    close.textContent = '×';
    close.title = 'Fechar';
    close.addEventListener('click', closeBubble);
    bubble.appendChild(close);

    button.parentElement?.appendChild(bubble);
    activeBubble = bubble;
  }

  function closeBubble() {
    activeBubble?.remove();
    activeBubble = null;
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
})();
