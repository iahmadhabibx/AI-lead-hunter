export type DetectedCvFormat = 'pdf' | 'docx';

export class UnsafeCvFileError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'UnsafeCvFileError';
  }
}

const PDF_MAGIC = Buffer.from('%PDF');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Validate file content by magic bytes (not client MIME/extension alone).
 */
export function detectCvFormat(buffer: Buffer): DetectedCvFormat {
  if (buffer.length < 5) {
    throw new UnsafeCvFileError('File is too small to be a valid CV');
  }

  if (buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    return 'pdf';
  }

  if (buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
    // DOCX is a ZIP package; require [Content_Types].xml and word/ markers.
    const asString = buffer.toString('binary');
    const hasContentTypes = asString.includes('[Content_Types].xml');
    const hasWord = asString.includes('word/');
    if (hasContentTypes && hasWord) {
      return 'docx';
    }
    throw new UnsafeCvFileError(
      'ZIP archive is not a valid DOCX document',
    );
  }

  throw new UnsafeCvFileError(
    'Unsupported file type. Only PDF and DOCX are accepted',
  );
}

export function assertUploadSize(
  byteLength: number,
  maxBytes: number,
): void {
  if (byteLength <= 0) {
    throw new UnsafeCvFileError('Empty uploads are not allowed');
  }
  if (byteLength > maxBytes) {
    throw new UnsafeCvFileError(
      `File exceeds maximum size of ${maxBytes} bytes`,
    );
  }
}
