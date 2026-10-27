import { z } from 'zod';

export const BackgroundTaskStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);

export type BackgroundTaskStatus = z.infer<typeof BackgroundTaskStatusSchema>;

export const BackgroundTaskTypeSchema = z.enum([
  'cv.process',
  'jobs.discover',
  'jobs.match',
  'docs.generate',
  'account.export',
  'account.delete',
]);

export type BackgroundTaskType = z.infer<typeof BackgroundTaskTypeSchema>;

export const BackgroundTaskSchema = z.object({
  id: z.string().uuid(),
  type: BackgroundTaskTypeSchema,
  status: BackgroundTaskStatusSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BackgroundTask = z.infer<typeof BackgroundTaskSchema>;
