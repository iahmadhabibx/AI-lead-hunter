import { createAiRuntime, type AiRuntime, type ExtractionResult } from '@aijh/ai-runtime';
import {
  calculateExperienceMonths,
  CandidateProfilePayloadSchema,
} from '@aijh/contracts';
import { assertUploadSize, detectCvFormat } from './file-validation';
import { extractCvText } from './extract-text';

export type ProcessCvInput = {
  buffer: Buffer;
  maxBytes: number;
  ai: AiRuntime;
  documentId?: string;
};

export type ProcessCvOutput = {
  format: 'pdf' | 'docx';
  text: string;
  extraction: ExtractionResult;
};

export function createDefaultAiRuntime(env: {
  AI_PROVIDER: 'mock' | 'ollama';
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL?: string;
}): AiRuntime {
  return createAiRuntime({
    provider: env.AI_PROVIDER,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    ollamaModel: env.OLLAMA_MODEL,
  });
}

export async function processCvBuffer(
  input: ProcessCvInput,
): Promise<ProcessCvOutput> {
  assertUploadSize(input.buffer.byteLength, input.maxBytes);
  const format = detectCvFormat(input.buffer);
  const { text } = await extractCvText(input.buffer, format);
  const extraction = await input.ai.extractCandidateProfile({
    text,
    documentId: input.documentId,
  });

  const withExperience = {
    ...extraction.payload,
    totalExperienceMonths: calculateExperienceMonths(
      extraction.payload.employment,
    ),
  };
  const payload = CandidateProfilePayloadSchema.parse(withExperience);

  return {
    format,
    text,
    extraction: { ...extraction, payload },
  };
}
