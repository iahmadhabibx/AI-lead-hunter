import { z } from 'zod';

export const AccountDeleteRequestSchema = z.object({
  confirmEmail: z.string().email(),
  confirmPhrase: z.literal('DELETE MY ACCOUNT'),
});

export type AccountDeleteRequest = z.infer<typeof AccountDeleteRequestSchema>;

export const AccountExportResponseSchema = z.object({
  taskId: z.string().uuid(),
  status: z.literal('queued'),
  note: z.string(),
});

export type AccountExportResponse = z.infer<typeof AccountExportResponseSchema>;
