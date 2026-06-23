import { z } from 'zod';
import { CuidSchema } from './common.js';

export const EmailSchema = z.string().email().max(254);
export const PasswordSchema = z.string().min(8).max(200);

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(1).max(80).optional(),
});
export type Register = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});
export type Login = z.infer<typeof LoginSchema>;

/** Public user shape (never includes the password hash). */
export const PublicUserSchema = z.object({
  id: CuidSchema,
  email: EmailSchema,
  name: z.string().nullable(),
  createdAt: z.string().datetime().optional(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const AuthResponseSchema = z.object({
  user: PublicUserSchema,
  token: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
