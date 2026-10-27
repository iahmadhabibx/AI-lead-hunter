import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectCvFormat } from './file-validation';
import { extractCvText } from './extract-text';

describe('extractCvText', () => {
  it('extracts text from the sample DOCX fixture', async () => {
    const file = path.resolve(
      __dirname,
      '../../../tests/fixtures/sample-cv.docx',
    );
    const buffer = readFileSync(file);
    expect(detectCvFormat(buffer)).toBe('docx');
    const result = await extractCvText(buffer, 'docx');
    expect(result.text).toContain('Ada Lovelace');
    expect(result.text).toContain('ada@example.com');
    expect(result.usedOcr).toBe(false);
  });
});
