import { describe, expect, it } from 'vitest';
import {
  assertUploadSize,
  detectCvFormat,
  UnsafeCvFileError,
} from './file-validation';

describe('detectCvFormat', () => {
  it('detects PDF magic bytes', () => {
    const buf = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from('rest'),
    ]);
    expect(detectCvFormat(buf)).toBe('pdf');
  });

  it('rejects random bytes', () => {
    expect(() => detectCvFormat(Buffer.from('hello world!!!!'))).toThrow(
      UnsafeCvFileError,
    );
  });

  it('detects DOCX-like zip markers', () => {
    const buf = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from('....[Content_Types].xml....word/document.xml....'),
    ]);
    expect(detectCvFormat(buf)).toBe('docx');
  });
});

describe('assertUploadSize', () => {
  it('rejects empty and oversized files', () => {
    expect(() => assertUploadSize(0, 100)).toThrow(UnsafeCvFileError);
    expect(() => assertUploadSize(101, 100)).toThrow(UnsafeCvFileError);
    expect(() => assertUploadSize(50, 100)).not.toThrow();
  });
});
