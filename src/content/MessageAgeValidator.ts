export class MessageAgeValidator {
  private static readonly TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  public isWithinLast24Hours(messageElement: HTMLElement, now: number = Date.now()): boolean {
    const timestamp = this.extractMessageTimestamp(messageElement);
    if (timestamp === null) {
      return true;
    }
    const ageMs = now - timestamp;
    if (ageMs < 0) {
      return true;
    }
    return ageMs <= MessageAgeValidator.TWENTY_FOUR_HOURS_MS;
  }

  public extractMessageTimestamp(messageElement: HTMLElement): number | null {
    const attributeTime = this.extractFromDataAttribute(messageElement);
    if (attributeTime !== null) {
      return attributeTime;
    }
    const preTextTime = this.extractFromPrePlainText(messageElement);
    if (preTextTime !== null) {
      return preTextTime;
    }
    return this.extractFromTimeMeta(messageElement);
  }

  private extractFromDataAttribute(messageElement: HTMLElement): number | null {
    const raw =
      messageElement.getAttribute('data-timestamp') ||
      messageElement.dataset.timestamp ||
      messageElement.getAttribute('data-time') ||
      messageElement.dataset.time;

    if (!raw) {
      return null;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed <= 0) {
      return null;
    }
    if (parsed < 10000000000) {
      return parsed * 1000;
    }
    return parsed;
  }

  private extractFromPrePlainText(messageElement: HTMLElement): number | null {
    const hasPreAttr =
      typeof messageElement.hasAttribute === 'function' &&
      messageElement.hasAttribute('data-pre-plain-text');
    const element =
      messageElement.querySelector<HTMLElement>('[data-pre-plain-text]') ||
      (hasPreAttr ? messageElement : null);

    if (!element) {
      return null;
    }
    const text = element.getAttribute('data-pre-plain-text') || '';
    return this.parsePrePlainText(text);
  }

  private parsePrePlainText(text: string): number | null {
    const match = text.match(
      /\[(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap]\.?m\.?))?,\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\]/i
    );
    if (!match) {
      return null;
    }
    return this.buildDateFromMatch(match);
  }

  private buildDateFromMatch(match: RegExpMatchArray): number | null {
    let hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const meridian = match[3]?.toLowerCase();
    const day = parseInt(match[4] || '0', 10);
    const month = parseInt(match[5] || '0', 10) - 1;
    const year = parseInt(match[6] || '0', 10);

    if (meridian?.includes('p') && hours < 12) {
      hours += 12;
    }
    if (meridian?.includes('a') && hours === 12) {
      hours = 0;
    }

    const date = new Date(year, month, day, hours, minutes);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.getTime();
  }

  private extractFromTimeMeta(messageElement: HTMLElement): number | null {
    const metaElement = messageElement.querySelector<HTMLElement>(
      '[data-testid="msg-meta"], .copyable-text'
    );
    if (!metaElement) {
      return null;
    }
    const rawText = metaElement.textContent || '';
    const dateMatch = rawText.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (!dateMatch) {
      return null;
    }
    const day = parseInt(dateMatch[1] || '0', 10);
    const month = parseInt(dateMatch[2] || '0', 10) - 1;
    const year = parseInt(dateMatch[3] || '0', 10);
    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date.getTime();
  }
}
