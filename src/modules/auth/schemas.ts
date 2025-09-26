import { z } from 'zod';
// TODO: Implement additional security checks like Reserved usernames (admin, system, etc.) and potentially offensive usernames.
// https://www.npmjs.com/package/bad-words
// https://github.com/alexzel/bad-words-next

const basePasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(63, 'Password must be less than 63 characters long');

export const loginSchema = z.object({
  email: z.string().email(),
  password: basePasswordSchema
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: basePasswordSchema.regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/,
    'Password must have a minimum of eight characters, at least one uppercase letter, one lowercase letter, one number and one special character'
  ),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters long')
    .max(63, 'Username must be less than 63 characters long')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'Username can only contain lowercase letters, numbers or hyphens. It must start or end with a letter or a number.'
    )
    .refine(
      (val) => !val.includes('--'),
      'Username can not use consecutive hyphens.'
    )
    .transform((val) => val.toLowerCase()),
  firstName: z
    .string()
    .min(1, 'Must enter at least one character')
    .max(63, 'Must be less than 63 characters long'),
  lastName: z
    .string()
    .min(1, 'Must enter at least one character')
    .max(63, 'Must be less than 63 characters long')
});
