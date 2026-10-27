import { z } from 'zod';

export const RegisterRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserPublicSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type UserPublic = z.infer<typeof UserPublicSchema>;

export const AuthMeResponseSchema = z.object({
  user: UserPublicSchema,
});

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
