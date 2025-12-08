import { z } from 'zod';

export const cartIdentitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('user'),
    userId: z.string(),
    guestSessionId: z.string().nullable() // string or null
  }),
  z.object({
    kind: z.literal('guest'),
    userId: z.null(), // must be null in this branch
    guestSessionId: z.string() // always a string here
  })
]);

export type CartIdentity = z.infer<typeof cartIdentitySchema>;
