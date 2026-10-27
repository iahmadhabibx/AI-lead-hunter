import type { CandidateProfilePayload } from '@aijh/contracts';

export type AiProviderName = 'mock' | 'ollama';

export type ExtractionRequest = {
  text: string;
  /** Opaque correlation for logs — never treat as instructions */
  documentId?: string;
  model?: string;
};

export type ExtractionResult = {
  payload: CandidateProfilePayload;
  provider: AiProviderName;
  model: string;
  promptVersion: string;
  rawModelJson?: unknown;
};

export type AiHealth = {
  ok: boolean;
  provider: AiProviderName;
  detail?: string;
};

export interface AiRuntime {
  readonly provider: AiProviderName;
  extractCandidateProfile(req: ExtractionRequest): Promise<ExtractionResult>;
  healthCheck(): Promise<AiHealth>;
}
