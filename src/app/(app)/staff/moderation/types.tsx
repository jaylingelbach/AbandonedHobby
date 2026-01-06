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
