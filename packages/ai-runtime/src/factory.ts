import { MockAiAdapter } from './mock-adapter';
import { OllamaAiAdapter } from './ollama-adapter';
import type { AiProviderName, AiRuntime } from './types';

export function createAiRuntime(options: {
  provider: AiProviderName;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}): AiRuntime {
  if (options.provider === 'ollama') {
    return new OllamaAiAdapter({
      baseUrl: options.ollamaBaseUrl ?? 'http://127.0.0.1:11434',
      model: options.ollamaModel ?? '',
    });
  }
  return new MockAiAdapter();
}
