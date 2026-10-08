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
      .wgt-transcribe-button {
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
      .wgt-transcribe-button:disabled { opacity: .6 !important; cursor: wait !important; }
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
      .wgt-close:hover,
      .dark .wgt-close:hover,
      [data-theme="dark"] .wgt-close:hover {
        color: #111b21 !important;
      }
      .dark .wgt-close:hover {
        color: #e9edef !important;
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
