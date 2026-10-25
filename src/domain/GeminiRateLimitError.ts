export class GeminiRateLimitError extends Error {
  public readonly retryDelayMs: number;
  public readonly rawErrorDetails?: unknown;

  constructor(message: string, retryDelayMs: number = 60000, rawErrorDetails?: unknown) {
    super(message);
    this.name = 'GeminiRateLimitError';
    this.retryDelayMs = retryDelayMs;
    this.rawErrorDetails = rawErrorDetails;
  }
}
