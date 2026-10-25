/**
 * Objeto de Valor que encapsula o resultado em texto da transcrição.
 */
export class TranscriptionText {
  private readonly textContent: string;

  constructor(rawResult: string) {
    const cleaned = rawResult
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    if (cleaned.length === 0) {
      throw new Error('O conteúdo da transcrição não pode ser vazio.');
    }
    this.textContent = cleaned;
  }

  public wordCount(): number {
    const tokens = this.textContent.split(/\s+/);
    return tokens.filter((token) => token.length > 0).length;
  }

  public toDisplayText(): string {
    return this.textContent;
  }
}
