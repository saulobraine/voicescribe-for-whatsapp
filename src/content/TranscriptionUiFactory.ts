import { MessageDirectionDetector } from './MessageDirectionDetector.js';

export class TranscriptionUiFactory {
  private static readonly BUTTON_CLASS = 'wgt-transcribe-button';
  private static readonly CONTAINER_CLASS = 'wgt-container';
  private static readonly BUBBLE_CLASS = 'wgt-bubble';
  private static readonly STYLE_ID = 'wgt-styles';

  private readonly directionDetector: MessageDirectionDetector;

  constructor(directionDetector: MessageDirectionDetector = new MessageDirectionDetector()) {
    this.directionDetector = directionDetector;
  }

  public getOrCreateContainer(messageElement: HTMLElement, targetElement?: HTMLElement): HTMLElement {
    const direction = this.directionDetector.detect(messageElement);
    let container = messageElement.querySelector<HTMLElement>(`.${TranscriptionUiFactory.CONTAINER_CLASS}`);
    const messageContainer = targetElement?.closest<HTMLElement>('[data-testid="msg-container"]') ||
      messageElement.querySelector<HTMLElement>('[data-testid="msg-container"]');

    if (container) {
      direction.applyToContainer(container);
      if (messageContainer && messageContainer.parentNode && container.parentNode !== messageContainer.parentNode) {
        messageContainer.after(container);
      }
      return container;
    }

    container = document.createElement('div');
    container.className = TranscriptionUiFactory.CONTAINER_CLASS;
    direction.applyToContainer(container);

    if (messageContainer && messageContainer.parentNode) {
      messageContainer.after(container);
      return container;
    }

    messageElement.appendChild(container);
    return container;
  }

  public createTranscribeButton(onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = TranscriptionUiFactory.BUTTON_CLASS;
    button.type = 'button';
    button.textContent = '🎙 Transcrever';
    button.title = 'Transcrever áudio com Gemini';

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) {
        return;
      }
      onClick(button);
    });

    return button;
  }

  public renderBubble(
    container: HTMLElement,
    text: string,
    isError: boolean = false,
    onClose?: () => void
  ): HTMLElement {
    this.clearBubbles(container);

    const bubble = document.createElement('div');
    bubble.className = TranscriptionUiFactory.BUBBLE_CLASS;
    if (isError) {
      bubble.style.background = '#ffe8e6';
      bubble.style.color = '#c62828';
    }

    const content = document.createElement('div');
    content.textContent = text;
    bubble.appendChild(content);

    if (!isError) {
      const copyButton = this.createCopyButton(text);
      bubble.appendChild(copyButton);
    }

    const closeButton = this.createCloseButton(() => {
      bubble.remove();
      if (onClose) {
        onClose();
      }
    });
    bubble.appendChild(closeButton);

    container.appendChild(bubble);
    return bubble;
  }

  public clearBubbles(container: HTMLElement): void {
    const existing = container.querySelectorAll(`.${TranscriptionUiFactory.BUBBLE_CLASS}`);
    existing.forEach((bubble) => bubble.remove());
  }

  public injectStyles(): void {
    if (document.getElementById(TranscriptionUiFactory.STYLE_ID)) {
      return;
    }
    const styleElement = document.createElement('style');
    styleElement.id = TranscriptionUiFactory.STYLE_ID;
    styleElement.textContent = `
      .wgt-container {
        display: flex !important;
        flex-direction: column !important;
        box-sizing: border-box !important;
        clear: both !important;
        margin-top: 5px !important;
        margin-bottom: 5px !important;
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
      .wgt-transcribe-button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 3px 0 5px 0 !important;
        padding: 5px 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        border-radius: 14px !important;
        background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%) !important;
        color: #ffffff !important;
        font: 600 11.5px/1.2 system-ui, -apple-system, sans-serif !important;
        cursor: pointer !important;
        z-index: 9999 !important;
        min-height: 25px !important;
        box-shadow: 0 2px 8px rgba(6, 182, 212, 0.35) !important;
        transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      .wgt-transcribe-button:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 14px rgba(6, 182, 212, 0.5) !important;
        filter: brightness(1.08) !important;
      }
      .wgt-transcribe-button:active {
        transform: translateY(0) !important;
      }
      .wgt-transcribe-button:disabled {
        opacity: 0.65 !important;
        cursor: wait !important;
        transform: none !important;
      }
      .wgt-bubble {
        position: relative !important;
        margin: 5px 0 !important;
        padding: 11px 15px !important;
        padding-right: 34px !important;
        border-radius: 12px !important;
        background: #f8fafc !important;
        border: 1px solid rgba(6, 182, 212, 0.25) !important;
        color: #0f172a !important;
        font: 13px/1.45 system-ui, -apple-system, sans-serif !important;
        white-space: pre-wrap !important;
        max-width: 400px !important;
        box-sizing: border-box !important;
        display: inline-block !important;
        text-align: left !important;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08) !important;
      }
      .wgt-container.wgt-out .wgt-bubble {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%) !important;
        border-color: rgba(16, 185, 129, 0.35) !important;
        color: #064e3b !important;
      }
      .dark .wgt-container.wgt-in .wgt-bubble,
      [data-theme="dark"] .wgt-container.wgt-in .wgt-bubble {
        background: #0f172a !important;
        color: #f1f5f9 !important;
        border-color: rgba(6, 182, 212, 0.3) !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .dark .wgt-container.wgt-out .wgt-bubble,
      [data-theme="dark"] .wgt-container.wgt-out .wgt-bubble {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%) !important;
        color: #f1f5f9 !important;
        border-color: rgba(16, 185, 129, 0.45) !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
      }
      .wgt-close {
        position: absolute !important;
        right: 8px !important;
        top: 8px !important;
        border: 0 !important;
        background: transparent !important;
        color: #94a3b8 !important;
        font-size: 18px !important;
        cursor: pointer !important;
        width: 22px !important;
        height: 22px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        border-radius: 4px !important;
        transition: color 0.15s ease !important;
      }
      .wgt-close:hover,
      .dark .wgt-close:hover,
      [data-theme="dark"] .wgt-close:hover {
        color: #ef4444 !important;
        background: rgba(239, 68, 68, 0.1) !important;
      }
      .wgt-copy {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin-top: 9px !important;
        border: 1px solid rgba(6, 182, 212, 0.35) !important;
        border-radius: 6px !important;
        padding: 5px 10px !important;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.12) 100%) !important;
        color: #0284c7 !important;
        font: 600 12px/1 system-ui, -apple-system, sans-serif !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
      }
      .wgt-copy:hover {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 182, 212, 0.22) 100%) !important;
        border-color: rgba(6, 182, 212, 0.6) !important;
        transform: translateY(-1px) !important;
      }
      .dark .wgt-copy,
      [data-theme="dark"] .wgt-copy {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%) !important;
        border-color: rgba(6, 182, 212, 0.45) !important;
        color: #38bdf8 !important;
      }
    `;
    document.documentElement.appendChild(styleElement);
  }

  private createCopyButton(textToCopy: string): HTMLButtonElement {
    const copyButton = document.createElement('button');
    copyButton.className = 'wgt-copy';
    copyButton.type = 'button';
    copyButton.textContent = 'Copiar';
    copyButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(textToCopy);
      copyButton.textContent = 'Copiado!';
      setTimeout(() => {
        if (copyButton.isConnected) {
          copyButton.textContent = 'Copiar';
        }
      }, 1200);
    });
    return copyButton;
  }

  private createCloseButton(onClose: () => void): HTMLButtonElement {
    const closeButton = document.createElement('button');
    closeButton.className = 'wgt-close';
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.title = 'Fechar';
    closeButton.addEventListener('click', onClose);
    return closeButton;
  }
}
