export type MessageDirectionType = 'incoming' | 'outgoing';

/**
 * Objeto de Valor que encapsula a direção de uma mensagem do WhatsApp (Recebida vs Enviada).
 */
export class MessageDirection {
  private readonly direction: MessageDirectionType;

  constructor(direction: MessageDirectionType) {
    this.direction = direction;
  }

  public static incoming(): MessageDirection {
    return new MessageDirection('incoming');
  }

  public static outgoing(): MessageDirection {
    return new MessageDirection('outgoing');
  }

  public isOutgoing(): boolean {
    return this.direction === 'outgoing';
  }

  public toCssClass(): string {
    if (this.isOutgoing()) {
      return 'wgt-out';
    }
    return 'wgt-in';
  }

  public applyToContainer(containerElement: HTMLElement): void {
    containerElement.classList.remove('wgt-in', 'wgt-out');
    containerElement.classList.add(this.toCssClass());
  }
}
