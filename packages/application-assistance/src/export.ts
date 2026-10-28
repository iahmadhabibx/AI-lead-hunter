import type { GeneratedDocumentPayload } from '@aijh/contracts';

export type ExportedDocument = {
  filename: string;
  mimeType: string;
  body: string;
};

/** Export draft as Markdown text — never pretends to be an employer portal submission. */
export function exportDocumentMarkdown(
  doc: GeneratedDocumentPayload,
  opts?: { applicationId?: string },
): ExportedDocument {
  const safeType = doc.type.replace(/_/g, '-');
  const header = [
    `<!-- ForgePath export | type=${doc.type} | generation=${doc.schemaVersion} -->`,
    opts?.applicationId
      ? `<!-- applicationId=${opts.applicationId} -->`
      : null,
    `<!-- unsupportedClaims=${doc.unsupportedClaims.length} -->`,
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');

  return {
    filename: `${safeType}.md`,
    mimeType: 'text/markdown; charset=utf-8',
    body: `${header}${doc.contentMarkdown}\n`,
  };
}
