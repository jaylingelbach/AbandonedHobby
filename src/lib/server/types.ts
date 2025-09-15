import type { ClientSession } from 'mongoose';

/**
 * Allowed draft status values for collections with drafts enabled.
 */
export type DraftStatus = 'draft' | 'published';

/** Payload-style relationship reference: string id or { id }, optionally null/undefined. */
export type IdRef = string | { id: string } | null | undefined;

export type PayloadDbWithConnection = {
  connection: { startSession: () => Promise<ClientSession> };
};

/** Internal: start a mongoose session if supported by the current adapter. */
export type HasStartSession = {
  startSession: () => Promise<ClientSession>;
};

export type FindOneAndUpdateReturn =
  | Record<string, unknown>
  | { value: Record<string, unknown> | null }
  | null;

export type FindOneAndUpdateCapable = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown> | Record<string, unknown>[],
    options: Record<string, unknown>
  ) => Promise<FindOneAndUpdateReturn>;
};

export type DecProductStockResult =
  | { ok: true; after: number; archived: boolean }
  | { ok: false; reason: 'not-found' | 'not-tracked' | 'insufficient' };
