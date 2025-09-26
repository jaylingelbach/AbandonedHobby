import { Conversation, Message, User } from '@/payload-types';

/** Extract an id from a User relationship (string | User). Returns null if invalid. */
export function userIdFromRel(
  rel: string | User | null | undefined
): string | null {
  if (!rel) return null;
  return typeof rel === 'string'
    ? rel
    : typeof rel.id === 'string'
      ? rel.id
      : null;
}

/** Extract username from a User relationship (string | User). */
export function usernameFromRel(
  rel: string | User | null | undefined
): string | undefined {
  if (!rel || typeof rel === 'string') return undefined;
  return typeof rel.username === 'string' ? rel.username : undefined;
}

/** Coerce unknown date-ish value to ISO string safely. */
export function toISO(value: unknown): string {
  const d = new Date(
    typeof value === 'string' || typeof value === 'number'
      ? value
      : String(value)
  );
  if (isNaN(d.getTime())) {
    // Return a default or throw an error based on your requirements
    return new Date(0).toISOString(); // or throw new Error('Invalid date value')
  }
  return d.toISOString();
}

/** Narrow a Message sender (string | User) to a string id. */
export function senderIdFromMessage(m: Message): string | null {
  const rel = (m as { sender?: string | User }).sender;
  return userIdFromRel(rel ?? null);
}

/** Narrow a Conversation buyer/seller relation to string id. */
export function conversationUserId(
  rel: Conversation['buyer'] | Conversation['seller']
): string | null {
  return userIdFromRel(rel as string | User | null | undefined);
}

/** Read roomId from Conversation, tolerating legacy shapes. */
export function getRoomId(conv: Conversation): string | null {
  const r = (conv as Conversation & { roomId?: unknown }).roomId;
  return typeof r === 'string' && r.length > 0 ? r : null;
}
