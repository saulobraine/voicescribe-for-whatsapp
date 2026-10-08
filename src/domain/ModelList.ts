import { ModelIdentifier } from './ModelIdentifier.js';

/**
 * Coleção de primeira classe para manipulação de modelos disponíveis.
 */
export class ModelList {
  private readonly items: readonly ModelIdentifier[];

  constructor(items: readonly ModelIdentifier[]) {
    this.items = Object.freeze([...items]);
  }

  public static empty(): ModelList {
    return new ModelList([]);
  }

  public filterAudioCompatible(): ModelList {
    const filtered = this.items.filter((model) => model.isAudioInputCompatible());
    return new ModelList(filtered);
  }

  public firstOrDefault(fallback: ModelIdentifier): ModelIdentifier {
    const firstElement = this.items[0];
    if (firstElement !== undefined) {
      return firstElement;
    }
    return fallback;
  }

  public count(): number {
    return this.items.length;
  }

  public toNames(): string[] {
    return this.items.map((model) => model.toEndpointString());
  }

  public contains(targetName: string): boolean {
    return this.items.some((model) => model.toEndpointString() === targetName);
  }
}
