import { TRPCError } from '@trpc/server';

type IdRef = string | { id: string } | null | undefined;

export function asId(ref: IdRef): string {
  if (typeof ref === 'string') return ref;
  if (ref && typeof ref === 'object' && typeof ref.id === 'string')
    return ref.id;

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Missing or invalid tenant reference.'
  });
}
