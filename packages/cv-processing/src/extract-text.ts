import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import type { DetectedCvFormat } from './file-validation';

export type TextExtractionResult = {
  text: string;
  format: DetectedCvFormat;
  usedOcr: false;
  pageOrPartCount?: number;
};

/**
 * Extract plain text from PDF/DOCX. OCR is intentionally not enabled in Phase 1;
 * scanned PDFs that yield empty text fail with a clear error for the user.
 */
export async function extractCvText(
  buffer: Buffer,
  format: DetectedCvFormat,
): Promise<TextExtractionResult> {
  if (format === 'pdf') {
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? '').replace(/\u0000/g, '').trim();
    if (!text) {
      throw new Error(
        'No extractable text found in PDF. Scanned/image-only PDFs need OCR (not enabled yet).',
      );
    }
    return {
      text,
      format,
      usedOcr: false,
      pageOrPartCount: parsed.numpages,
    };
  }

  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value ?? '').replace(/\u0000/g, '').trim();
  if (!text) {
    throw new Error('No extractable text found in DOCX document');
  }
  return { text, format, usedOcr: false };
}
