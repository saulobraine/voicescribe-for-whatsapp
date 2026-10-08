(() => {
  if (window.top !== window) return;

  function isExtensionValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome?.runtime && chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  const BUTTON = 'wgt-transcribe-button';
  const STYLE = 'wgt-style';
  let lastAudio = null;
  let lastAudioAt = 0;

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
    if (!isExtensionValid()) {
      observer.disconnect();
      return;
    }

    const isInternalMutation = mutations.every(mutation => {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (nodes.length === 0) return true;
      return nodes.every(node => {
        if (node.nodeType !== 1) return true;
        return node.classList?.contains(BUTTON) ||
               node.classList?.contains('wgt-container') ||
               node.classList?.contains('wgt-bubble') ||
               node.querySelector?.(`.${BUTTON}, .wgt-container, .wgt-bubble`);
      });
    });
    if (isInternalMutation) return;

    clearTimeout(scan.timer);
    scan.timer = setTimeout(() => void scan(), 150);
  });

  // Escuta scroll em qualquer contêiner da página (para virtualização do chat e histórico)
  window.addEventListener('scroll', () => {
    if (!isExtensionValid()) return;
    clearTimeout(scan.timer);
    scan.timer = setTimeout(() => void scan(), 150);
  }, { capture: true, passive: true });

  // Verificação periódica suave de segurança (heartbeat para mensagens recicladas)
  const heartbeatInterval = setInterval(() => {
    if (!isExtensionValid()) {
      clearInterval(heartbeatInterval);
      return;
    }
    void scan();
  }, 1500);

  const startObserver = () => {
    if (!isExtensionValid()) return;
    const target = document.body || document.documentElement;
    if (target) observer.observe(target, { childList: true, subtree: true });
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
      .wgt-container {
        display: flex !important;
        flex-direction: column !important;
        box-sizing: border-box !important;
        clear: both !important;
        margin-top: 4px !important;
        margin-bottom: 4px !important;
        position: relative !important;
        max-width: 100% !important;
        z-index: 10 !important;
      }
      .wgt-container.wgt-in {
        align-self: flex-start !important;
        align-items: flex-start !important;
        text-align: left !important;
      }
      .wgt-container.wgt-out {
        align-self: flex-end !important;
        align-items: flex-end !important;
        text-align: right !important;
      }
      .${BUTTON} {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 2px 0 4px 0 !important;
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
        margin: 4px 0 !important;
        padding: 10px 14px !important;
        padding-right: 32px !important;
        border-radius: 8px !important;
        background: #f0f2f5 !important;
        color: #111b21 !important;
        font: 13px/1.4 system-ui,sans-serif !important;
        line-height: 1.4 !important;
        white-space: pre-wrap !important;
        max-width: 380px !important;
        box-sizing: border-box !important;
        display: inline-block !important;
        text-align: left !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.12) !important;
      }
      .wgt-container.wgt-out .wgt-bubble {
        background: #d9fdd3 !important;
      }
      .dark .wgt-container.wgt-in .wgt-bubble,
      [data-theme="dark"] .wgt-container.wgt-in .wgt-bubble {
        background: #202c33 !important;
        color: #e9edef !important;
      }
      .dark .wgt-container.wgt-out .wgt-bubble,
      [data-theme="dark"] .wgt-container.wgt-out .wgt-bubble {
        background: #005c4b !important;
        color: #e9edef !important;
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
      .wgt-close:hover {
        color: #111b21 !important;
      }
      .wgt-copy {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin-top: 8px !important;
        border: 0 !important;
        border-radius: 5px !important;
        padding: 4px 8px !important;
        background: rgba(0, 168, 132, 0.15) !important;
        color: #008069 !important;
        font: 600 12px/1 system-ui,sans-serif !important;
        cursor: pointer !important;
      }
      .dark .wgt-copy,
      [data-theme="dark"] .wgt-copy {
        background: rgba(255, 255, 255, 0.15) !important;
        color: #e9edef !important;
      }
      .dark .wgt-close:hover,
      [data-theme="dark"] .wgt-close:hover {
        color: #e9edef !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function findMessage(el) {
    if (!el?.closest) return null;
    return el.closest('[data-id]') ||
           el.closest('[data-testid^="conv-msg-"]') ||
           el.closest('[role="row"]') ||
           el.closest('.message-in, .message-out, .msg-container');
  }

  function getMessageDirection(message) {
    if (!message) return 'in';

    // 1. data-id explícito antigo (true_ = enviada, false_ = recebida)
    const dataId = message.getAttribute?.('data-id') || message.dataset?.id || '';
    if (dataId.startsWith('true_')) return 'out';
    if (dataId.startsWith('false_')) return 'in';

    // 2. Rabicho do balão da mensagem (tail-out vs tail-in)
    if (message.querySelector?.('[data-testid="tail-out"], [data-icon="tail-out"], span.tail-out')) {
      return 'out';
    }
    if (message.querySelector?.('[data-testid="tail-in"], [data-icon="tail-in"], span.tail-in')) {
      return 'in';
    }

    // 3. Rótulo de acessibilidade do remetente ("Você:" / "You:")
    if (message.querySelector?.('span[aria-label^="Você" i], span[aria-label^="You" i]')) {
      return 'out';
    }

    // 4. Classes CSS clássicas
    if (message.classList?.contains('message-out') || message.closest?.('.message-out') || message.querySelector?.('.message-out')) {
      return 'out';
    }
    if (message.classList?.contains('message-in') || message.closest?.('.message-in') || message.querySelector?.('.message-in')) {
      return 'in';
    }

    // 5. Metadados e status de envio (exclusivos de mensagens enviadas)
    const msgMeta = message.querySelector?.('[data-testid="msg-meta"]');
    if (msgMeta) {
      if (msgMeta.querySelector?.(
        '[data-icon*="check"], [data-icon="msg-time"], ' +
        'span[aria-label*="Entregue" i], span[aria-label*="Lido" i], span[aria-label*="Enviad" i], ' +
        'span[aria-label*="Delivered" i], span[aria-label*="Read" i], span[aria-label*="Sent" i]'
      )) {
        return 'out';
      }
      const metaSvgTitles = msgMeta.querySelectorAll?.('svg title');
      for (const t of metaSvgTitles) {
        const text = (t.textContent || '').toLowerCase();
        if (text.includes('read') || text.includes('delivered') || text.includes('check') || text.includes('time')) {
          return 'out';
        }
      }
    }

    // 6. Verificação geométrica de posição relativa à linha do chat (mensagens consecutivas sem tail)
    try {
      const msgBox = message.querySelector?.('[data-testid="msg-container"]') || message;
      const row = message.closest?.('[role="row"]') || 
                  message.closest?.('[data-testid^="conv-msg-"]') || 
                  document.querySelector('#main') || 
                  message;
      if (msgBox && row) {
        const bubbleRect = msgBox.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        if (rowRect.width > 50 && bubbleRect.width > 50) {
          const distLeft = bubbleRect.left - rowRect.left;
          const distRight = rowRect.right - bubbleRect.right;
          // Mensagem enviada fica colada na margem direita (distRight < distLeft)
          // Mensagem recebida fica colada na margem esquerda (distLeft < distRight)
          if (distRight < distLeft) {
            return 'out';
          }
          return 'in';
        }
      }
    } catch {}

    return 'in';
  }

  function getOrCreateContainer(message, target = null) {
    const direction = getMessageDirection(message);
    let container = message.querySelector('.wgt-container');
    const msgContainer = target?.closest?.('[data-testid="msg-container"]') || message.querySelector?.('[data-testid="msg-container"]');

    // Se já existe, garante que a classe de direção está atualizada e reposiciona se necessário
    if (container) {
      if (!container.classList.contains(`wgt-${direction}`)) {
        container.classList.remove('wgt-in', 'wgt-out');
        container.classList.add(`wgt-${direction}`);
      }
      if (msgContainer && msgContainer.parentNode && container.parentNode !== msgContainer.parentNode) {
        msgContainer.after(container);
      }
      return container;
    }

    container = document.createElement('div');
    container.className = `wgt-container wgt-${direction}`;

    // Insere o container logo após o msg-container para herdar o alinhamento exato da mensagem
    if (msgContainer && msgContainer.parentNode) {
      msgContainer.after(container);
    } else {
      message.appendChild(container);
    }

    return container;
  }

  function findMedia(message) {
    if (!message) return null;
    const media = [...message.querySelectorAll('audio,video')]
      .find(x => x.currentSrc || x.src);
    return media || null;
  }

  function updateExistingContainers() {
    document.querySelectorAll('.wgt-container').forEach(container => {
      const message = findMessage(container);
      if (!message) return;
      const direction = getMessageDirection(message);
      if (!container.classList.contains(`wgt-${direction}`)) {
        container.classList.remove('wgt-in', 'wgt-out');
        container.classList.add(`wgt-${direction}`);
      }
      const msgContainer = message.querySelector?.('[data-testid="msg-container"]');
      if (msgContainer && msgContainer.parentNode && container.parentNode !== msgContainer.parentNode) {
        msgContainer.after(container);
      }
    });
  }

  async function scan() {
    if (!isExtensionValid()) {
      observer.disconnect();
      return;
    }

    updateExistingContainers();

    const candidates = document.querySelectorAll(
      'audio, video, ' +
      '[data-testid*="audio"], [data-testid*="ptt"], [data-testid*="voice"], ' +
      '[data-icon*="audio-play"], [data-icon*="ptt"], span.ptt-status, ' +
      'button[aria-label*="Reproduzir" i], button[aria-label*="Play" i], ' +
      '[aria-label*="Mensagem de voz" i], [aria-label*="Voice message" i], ' +
      'div[role="slider"][aria-label*="voz" i], div[role="slider"][aria-label*="voice" i]'
    );

    const seen = new Set();
    for (const target of candidates) {
      const message = findMessage(target);
      if (!message || seen.has(message) || message.querySelector(`.${BUTTON}`)) continue;

      seen.add(message);

      const button = addButton(message, target);
      void checkMessageCache(message, button);
    }
  }

  async function checkMessageCache(message, button) {
    if (!isExtensionValid()) {
      observer.disconnect();
      return;
    }

    try {
      const cached = await getCachedTranscript(message);
      if (!cached) return;

      if (button && button.isConnected) {
        button.textContent = '✓ Cache';
        button.title = 'Transcrição em cache (clique para alternar)';
      }

      const container = getOrCreateContainer(message);
      if (!container.querySelector('.wgt-bubble') && !message.dataset.wgtClosed) {
        showBubble(container, cached, false, message);
      }
    } catch (e) {
      if (e?.message?.includes('Extension context invalidated')) {
        observer.disconnect();
        return;
      }
      console.warn('[WGT] Erro ao carregar cache da mensagem:', e);
    }
  }

  function showCachedBubble(message, text) {
    const container = getOrCreateContainer(message);
    showBubble(container, text, false, message);
  }

  function addButton(message, target) {
    const container = getOrCreateContainer(message, target);

    let button = container.querySelector(`.${BUTTON}`);
    if (button) return button;

    button = document.createElement('button');
    button.className = BUTTON;
    button.type = 'button';
    button.textContent = '🎙 Transcrever';
    button.title = 'Transcrever áudio com Gemini';

    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;

      if (!isExtensionValid()) {
        showBubble(container, 'A extensão foi atualizada. Recarregue a página (F5) para continuar.', true, message);
        return;
      }

      // 1. Verifica cache antes de qualquer download/reprodução de áudio
      const cached = await getCachedTranscript(message);
      if (cached) {
        button.textContent = '✓ Cache';
        const existing = container.querySelector('.wgt-bubble');
        if (existing) {
          existing.remove();
          message.dataset.wgtClosed = 'true';
        } else {
          delete message.dataset.wgtClosed;
          showBubble(container, cached, false, message);
        }
        return;
      }

      button.disabled = true;
      button.textContent = '⏳ Transcrevendo...';
      closeBubble(container);

      try {
        const dataUrl = await obtainAudio(message, target);
        const result = await sendForTranscription(dataUrl);
        button.textContent = '✓ Transcrito';
        await cacheTranscript(message, result); // Salva no cache
        delete message.dataset.wgtClosed;
        showBubble(container, result, false, message);
      } catch (error) {
        // Cota atingida nas chaves do pool
        if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('Limite da API')) {
          button.textContent = '🕐 Cooldown';
          showBubble(container, `${error.message}\n\nDica: você pode adicionar novas chaves em "Gerenciar API Keys".`, false, message);
          setTimeout(() => {
            if (button.isConnected) {
              button.disabled = false;
              button.textContent = '🎙 Transcrever';
            }
          }, 3500);
          return;
        }

        // Alta demanda da API é transitória — mensagem informativa, não erro
        if (/high demand|overloaded|try again later/i.test(error.message || '')) {
          button.textContent = '⏳ Aguarde';
          showBubble(container, 'A API do Gemini está sob alta demanda.\nTente novamente em instantes.', false, message);
          setTimeout(() => {
            if (button.isConnected) {
              button.disabled = false;
              button.textContent = '🎙 Transcrever';
            }
          }, 3000);
          return;
        }

        // Outros erros são tratados normalmente
        console.error('[WGT]', error);
        button.textContent = '✕ Erro';
        showBubble(container, error.message || 'Falha na transcrição.', true, message);
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

    container.appendChild(button);
    return button;
  }

  function requestAudioFromPage(url, minTimestamp = null) {
    return new Promise((resolve, reject) => {
      const requestId = 'wgt_' + Math.random().toString(36).slice(2, 9);
      const timer = setTimeout(() => {
        window.removeEventListener('wgt-response-audio', handler);
        reject(new Error('Tempo limite excedido ao capturar o áudio da página.'));
      }, 8000);

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
        detail: { requestId, url, minTimestamp }
      }));
    });
  }

  function findPlayButton(message) {
    if (!message) return null;

    // 1. Seletores específicos de botão de play do WhatsApp Web
    const specific = message.querySelector(
      '[data-testid="audio-play"], [data-testid="ptt-play"], [data-testid="play"], ' +
      '[data-icon="audio-play"], [data-icon="audio-play-filled"], [data-icon="play"], ' +
      'button[aria-label*="Reproduzir" i], button[aria-label*="Play" i], ' +
      '[aria-label*="Reproduzir" i], [aria-label*="Play" i]'
    );
    if (specific) return specific;

    // 2. Procura botão dentro do player de áudio que não seja da nossa extensão
    const playerWrapper = message.querySelector('[data-testid*="audio"], [data-testid*="ptt"], .audio-player');
    if (playerWrapper) {
      const btn = playerWrapper.querySelector('button:not(.wgt-transcribe-button):not(.wgt-copy):not(.wgt-close)');
      if (btn) return btn;
    }

    // 3. Qualquer botão na mensagem que contenha SVG de play
    const allButtons = message.querySelectorAll('button:not(.wgt-transcribe-button):not(.wgt-copy):not(.wgt-close)');
    for (const btn of allButtons) {
      if (btn.querySelector('[data-icon*="play"], svg')) {
        return btn;
      }
    }

    return null;
  }

  function findPauseButton(message) {
    if (!message) return null;

    // Botão de pause do WhatsApp — ícones que indicam estado "tocando"
    const specific = message.querySelector(
      '[data-testid="audio-pause"], [data-testid="ptt-pause"], [data-testid="pause"], ' +
      '[data-icon="audio-pause"], [data-icon="audio-pause-filled"], [data-icon="pause"], ' +
      'button[aria-label*="Pausar" i], button[aria-label*="Pause" i], ' +
      '[aria-label*="Pausar" i], [aria-label*="Pause" i]'
    );
    if (specific) return specific;

    return null;
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

    const captureStartTime = Date.now();
    let capturedAudioUrl = null;

    // Escuta novo áudio emitido estritamente a partir deste momento
    const audioListener = (event) => {
      const detail = event.detail || {};
      if (detail.url && (!detail.timestamp || detail.timestamp >= captureStartTime)) {
        capturedAudioUrl = detail.url;
      }
    };
    window.addEventListener('wgt-audio', audioListener);

    // 2. Se a mídia ainda não foi carregada no DOM, dispara o Play de forma silenciosa
    try {
      window.dispatchEvent(new CustomEvent('wgt-silent-capture-start'));

      if (media) {
        try {
          media.muted = true;
          media.volume = 0;
        } catch {}
      }

      const play = findPlayButton(message);
      if (play) {
        play.click();
      }

      // 3. Aguarda o WhatsApp baixar, decodificar e disponibilizar a mídia
      for (let i = 0; i < 30; i++) {
        await sleep(200);

        // Checa se o interceptor avisou sobre a criação do novo áudio
        if (capturedAudioUrl) {
          try {
            const dataUrl = await requestAudioFromPage(capturedAudioUrl);
            if (dataUrl) return dataUrl;
          } catch {}
        }

        // Checa se a tag de áudio na mensagem recebeu a nova URL
        media = findMedia(message);
        url = media?.currentSrc || media?.src || null;
        if (url) {
          try {
            media.muted = true;
            media.volume = 0;
            media.pause();
            media.currentTime = 0;
          } catch {}
          try {
            const dataUrl = await requestAudioFromPage(url);
            if (dataUrl) return dataUrl;
          } catch {}
        }
      }

      // 4. Última tentativa: solicita apenas áudio gerado após captureStartTime
      try {
        const fallbackDataUrl = await requestAudioFromPage(null, captureStartTime);
        if (fallbackDataUrl) return fallbackDataUrl;
      } catch {}

      throw new Error('Não consegui obter o arquivo de áudio. Reproduza a mensagem e tente novamente.');
    } finally {
      window.removeEventListener('wgt-audio', audioListener);

      // Para o áudio pelo botão do próprio WhatsApp (evita que o player avance para o próximo)
      const pauseBtn = findPauseButton(message);
      if (pauseBtn) {
        try { pauseBtn.click(); } catch {}
        // Pequena espera para o WhatsApp processar a pausa
        await sleep(50);
      }

      // Fallback: pausa diretamente no elemento de mídia se ainda estiver tocando
      media = findMedia(message);
      if (media && !media.paused) {
        try {
          media.pause();
          media.currentTime = 0;
        } catch {}
      }

      // Sinaliza fim da captura silenciosa (desativa mute em todos os elementos)
      window.dispatchEvent(new CustomEvent('wgt-silent-capture-stop'));

      // Restaura volume de TODOS os elementos imediatamente (espelho do mute-all do início)
      document.querySelectorAll('audio, video').forEach(el => {
        try { el.muted = false; el.volume = 1; } catch {}
      });
    }
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
    // WhatsApp Web moderno: id de mensagem em hex longo (ex: AC671504A3D9209B875BAFDBCC5CD06E)
    if (/^[0-9A-Za-z]{16,}$/.test(id)) return true;
    return false;
  }

  function getMessageId(message) {
    if (!message) return null;

    // data-id do próprio wrapper canônico da mensagem
    const selfId = message.getAttribute?.('data-id') || message.dataset?.id;
    if (isSpecificMessageId(selfId)) return selfId;

    // Sem data-id válido: não usa cache (chave errada = transcrição exibida
    // em outra mensagem; é melhor não cachear do que duplicar)
    return null;
  }

  function getMessageCacheKey(message) {
    const id = getMessageId(message);
    if (!id) return null;
    const sanitized = String(id).replace(/[^a-zA-Z0-9_@-]/g, '_');
    return `wgt_msg_cache_${sanitized}`;
  }

  async function getCachedTranscript(message) {
    if (!isExtensionValid()) return null;
    if (!chrome.storage || !chrome.storage.local) return null;
    const key = getMessageCacheKey(message);
    if (!key) return null;
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key]?.transcript || null;
    } catch (e) {
      if (e?.message?.includes('Extension context invalidated')) {
        observer.disconnect();
      }
      return null;
    }
  }

  async function cacheTranscript(message, transcript) {
    if (!isExtensionValid()) return;
    if (!chrome.storage || !chrome.storage.local) return;
    const key = getMessageCacheKey(message);
    if (!key) return;
    try {
      await chrome.storage.local.set({
        [key]: {
          transcript,
          timestamp: Date.now(),
          id: getMessageId(message)
        }
      });
    } catch (e) {
      if (e?.message?.includes('Extension context invalidated')) {
        observer.disconnect();
      }
    }
  }

  // Remove chaves de cache legadas geradas com IDs genéricos do chat inteiro
  async function cleanupLegacyCache() {
    if (!isExtensionValid()) return;
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
    } catch (e) {
      if (e?.message?.includes('Extension context invalidated')) {
        observer.disconnect();
      }
    }
  }


  function sendForTranscription(audioData) {
    return new Promise((resolve, reject) => {
      if (!isExtensionValid()) {
        observer.disconnect();
        return reject(new Error('A extensão foi atualizada. Por favor, recarregue a página (F5).'));
      }
      try {
        chrome.runtime.sendMessage({ action: 'transcribeAudio', audioData }, response => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!response?.success) return reject(new Error(response?.error || 'Erro desconhecido.'));
          resolve(response.data);
        });
      } catch (err) {
        if (err?.message?.includes('Extension context invalidated')) {
          observer.disconnect();
          return reject(new Error('A extensão foi atualizada. Por favor, recarregue a página (F5).'));
        }
        reject(err);
      }
    });
  }

  function showBubble(target, text, error = false, message = null) {
    const container = target?.classList?.contains('wgt-container')
      ? target
      : (target?.closest?.('.wgt-container') || target?.parentElement);
    if (!container) return;

    closeBubble(container);

    const bubble = document.createElement('div');
    bubble.className = 'wgt-bubble';
    if (error) bubble.style.background = '#ffe8e6';

    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    if (!error) {
      const copy = document.createElement('button');
      copy.className = 'wgt-copy';
      copy.type = 'button';
      copy.textContent = 'Copiar';
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copiado!';
        setTimeout(() => {
          if (copy.isConnected) copy.textContent = 'Copiar';
        }, 1200);
      });
      bubble.appendChild(copy);
    }

    const close = document.createElement('button');
    close.className = 'wgt-close';
    close.type = 'button';
    close.textContent = '×';
    close.title = 'Fechar';
    close.addEventListener('click', () => {
      bubble.remove();
      if (message) message.dataset.wgtClosed = 'true';
    });
    bubble.appendChild(close);

    container.appendChild(bubble);
  }

  function closeBubble(target = null) {
    const container = target?.classList?.contains('wgt-container')
      ? target
      : (target?.closest?.('.wgt-container') || target?.parentElement);

    if (container) {
      container.querySelectorAll('.wgt-bubble').forEach(b => b.remove());
    } else {
      document.querySelectorAll('.wgt-bubble').forEach(b => b.remove());
    }
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
})();
