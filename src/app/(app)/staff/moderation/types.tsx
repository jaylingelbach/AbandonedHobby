export type ModerationInboxItem = {
  id: string;
  productName: string;
  tenantName: string;
  tenantSlug: string;
  flagReasonLabel: string;
  flagReasonOtherText?: string;
  thumbnailUrl?: string | null;
  reportedAtLabel: string;
};

export type ModerationRemovedItemDTO = {
  id: string;
  productName: string;
  tenantName: string;
  tenantSlug: string;
  thumbnailUrl?: string | null;
  removedAt: string; // ISO string for sorting
  removedAtLabel: string;
  flagReasonLabel: string; // human label for the removal reason
  flagReasonOtherText?: string;
  reportedAtLabel?: string;
  note?: string; // internal moderation note (what you required)
  actionId?: string; // moderation-actions doc id
  intentId?: string; // dedupe id that created the ModerationAction
};
