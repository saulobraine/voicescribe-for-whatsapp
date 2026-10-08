/**
 * Objeto de Valor (Value Object) que encapsula uma chave de API do Google Gemini.
 * Segue regras de Object Calisthenics: primitivo encapsulado, sem getters/setters clássicos, sem else.
 */
export class ApiKey {
  private readonly rawValue: string;

  constructor(value: string) {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0) {
      throw new Error('A chave de API não pode estar vazia.');
    }
    this.rawValue = trimmedValue;
  }

  public matches(candidateValue: string): boolean {
    return this.rawValue === candidateValue.trim();
  }

  public toMaskedString(): string {
    const length = this.rawValue.length;
    if (length <= 8) {
      return '****';
    }
    const prefix = this.rawValue.slice(0, 4);
    const suffix = this.rawValue.slice(-4);
    return `${prefix}...${suffix}`;
  }

  public toRawString(): string {
    return this.rawValue;
  }
}
