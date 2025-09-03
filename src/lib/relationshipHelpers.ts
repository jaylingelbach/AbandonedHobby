export type Relationship<T extends { id: string }> =
  | string
  | T
  | null
  | undefined;

/** Get the id from a Payload relationship (string | doc | null/undefined) */
export function relId<T extends { id: string }>(
  rel: Relationship<T>
): string | undefined {
  if (!rel) return undefined;
  return typeof rel === 'string' ? rel : rel.id;
}

/** Get the populated doc from a Payload relationship if present */
export function relDoc<T extends { id: string }>(
  rel: Relationship<T>
): T | undefined {
  if (!rel || typeof rel === 'string') return undefined;
  return rel;
}
