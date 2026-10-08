/**
 * Objeto de Valor que encapsula dados de áudio em formato Data URL Base64.
 */
export class AudioDataUrl {
  private readonly dataUrlString: string;

  constructor(value: string) {
    if (!value.startsWith('data:')) {
      throw new Error('A URL de áudio informada não possui o esquema data: válido.');
    }
    this.dataUrlString = value;
  }

  public extractMimeType(): string {
    const headerPart = this.dataUrlString.slice(5, 50);
    const separatorIndex = headerPart.indexOf(';');
    if (separatorIndex === -1) {
      return 'audio/ogg';
    }
    const candidateMimeType = headerPart.slice(0, separatorIndex).trim();
    if (candidateMimeType.length === 0) {
      return 'audio/ogg';
    }
    return candidateMimeType;
  }

  public extractBase64Payload(): string {
    const commaIndex = this.dataUrlString.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Formato Base64 inválido no Data URL.');
    }
    return this.dataUrlString.slice(commaIndex + 1);
  }

  public toRawDataUrl(): string {
    return this.dataUrlString;
  }
}
