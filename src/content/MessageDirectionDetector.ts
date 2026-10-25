import { MessageDirection } from '../domain/MessageDirection.js';

/**
 * Detector de direção (enviada vs recebida) para mensagens do WhatsApp Web.
 * Segue regras de Object Calisthenics: apenas 1 nível de indentação, sem else, métodos concisos.
 */
export class MessageDirectionDetector {
  public detect(messageElement: HTMLElement): MessageDirection {
    if (this.hasExplicitOutgoingId(messageElement)) {
      return MessageDirection.outgoing();
    }
    if (this.hasExplicitIncomingId(messageElement)) {
      return MessageDirection.incoming();
    }
    if (this.hasTailOut(messageElement)) {
      return MessageDirection.outgoing();
    }
    if (this.hasTailIn(messageElement)) {
      return MessageDirection.incoming();
    }
    if (this.hasSenderLabelYou(messageElement)) {
      return MessageDirection.outgoing();
    }
    if (this.hasLegacyOutgoingClass(messageElement)) {
      return MessageDirection.outgoing();
    }
    if (this.hasDeliveryStatusInMeta(messageElement)) {
      return MessageDirection.outgoing();
    }
    if (this.isGeometricallyOnRightSide(messageElement)) {
      return MessageDirection.outgoing();
    }
    return MessageDirection.incoming();
  }

  private hasExplicitOutgoingId(element: HTMLElement): boolean {
    const dataId = element.getAttribute('data-id') || element.dataset.id || '';
    return dataId.startsWith('true_');
  }

  private hasExplicitIncomingId(element: HTMLElement): boolean {
    const dataId = element.getAttribute('data-id') || element.dataset.id || '';
    return dataId.startsWith('false_');
  }

  private hasTailOut(element: HTMLElement): boolean {
    const selector = '[data-testid="tail-out"], [data-icon="tail-out"], span.tail-out';
    return Boolean(element.querySelector(selector));
  }

  private hasTailIn(element: HTMLElement): boolean {
    const selector = '[data-testid="tail-in"], [data-icon="tail-in"], span.tail-in';
    return Boolean(element.querySelector(selector));
  }

  private hasSenderLabelYou(element: HTMLElement): boolean {
    const selector = 'span[aria-label^="Você" i], span[aria-label^="You" i]';
    return Boolean(element.querySelector(selector));
  }

  private hasLegacyOutgoingClass(element: HTMLElement): boolean {
    return Boolean(element.classList.contains('message-out') || element.querySelector('.message-out'));
  }

  private hasDeliveryStatusInMeta(element: HTMLElement): boolean {
    const metaContainer = element.querySelector('[data-testid="msg-meta"]');
    if (!metaContainer) {
      return false;
    }
    const statusIcon = metaContainer.querySelector(
      '[data-icon*="check"], [data-icon="msg-time"], ' +
      'span[aria-label*="Entregue" i], span[aria-label*="Lido" i], span[aria-label*="Enviad" i], ' +
      'span[aria-label*="Delivered" i], span[aria-label*="Read" i], span[aria-label*="Sent" i]'
    );
    if (statusIcon) {
      return true;
    }
    const svgTitles = metaContainer.querySelectorAll('svg title');
    for (const title of svgTitles) {
      const text = (title.textContent || '').toLowerCase();
      if (text.includes('read') || text.includes('delivered') || text.includes('check') || text.includes('time')) {
        return true;
      }
    }
    return false;
  }

  private isGeometricallyOnRightSide(element: HTMLElement): boolean {
    try {
      const messageBox = (element.querySelector('[data-testid="msg-container"]') as HTMLElement) || element;
      const row = (element.closest('[role="row"]') as HTMLElement) || element;
      const bubbleRect = messageBox.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      if (rowRect.width <= 50 || bubbleRect.width <= 50) {
        return false;
      }

      const distLeft = bubbleRect.left - rowRect.left;
      const distRight = rowRect.right - bubbleRect.right;
      return distRight < distLeft;
    } catch {
      return false;
    }
  }
}
