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

/** Internal: get the Tenants collection handle from Payload's db. */
export type UpdateOneCapable = {
  updateOne: (
    filter: Record<string, unknown>,
    // allow both classic update docs and aggregation pipeline updates
    update: Record<string, unknown> | Record<string, unknown>[], // or: | PipelineStage[]
    options?: { session?: ClientSession }
  ) => Promise<unknown>;
};

export type PriceBounds = {
  greater_than_equal?: number;
  less_than_equal?: number;
};
