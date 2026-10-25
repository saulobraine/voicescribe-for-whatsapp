/**
 * Objeto de Valor que encapsula o identificador de modelo do Gemini.
 */
export class ModelIdentifier {
  private static readonly SANITIZATION_PATTERN = /[^a-zA-Z0-9._-]/g;
  private static readonly AUDIO_MODEL_PATTERN = /gemini-(3\.8|3\.7|3\.6|3\.5|3\.1|3|2\.5)-(flash|pro)/i;
  private static readonly SPECIAL_TRANSCRIBE_MODEL = 'gemini-3.5-transcribe';

  private readonly modelName: string;

  constructor(candidateName: string) {
    const sanitized = candidateName.trim().replace(ModelIdentifier.SANITIZATION_PATTERN, '');
    if (sanitized.length === 0) {
      throw new Error('O nome do modelo informado é inválido.');
    }
    this.modelName = sanitized;
  }

  public isDedicatedTranscriber(): boolean {
    return this.modelName === ModelIdentifier.SPECIAL_TRANSCRIBE_MODEL;
  }

  public isAudioInputCompatible(): boolean {
    if (this.isDedicatedTranscriber()) {
      return true;
    }
    return ModelIdentifier.AUDIO_MODEL_PATTERN.test(this.modelName);
  }

  public matches(otherModel: ModelIdentifier): boolean {
    return this.modelName === otherModel.modelName;
  }

  public toEndpointString(): string {
    return this.modelName;
  }
}
