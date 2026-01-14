export const moderationInboxTabs = [
  'inbox',
  'removed',
  'open_appeals'
] as const;

export type ModerationInboxTabs = (typeof moderationInboxTabs)[number];

export const BASE_LISTING_CLASS =
  'mt-1 h-8 w-full justify-center px-0 text-xs font-medium underline-offset-4 hover:underline';

export const actionTypes = ['approved', 'removed', 'reinstated'] as const;

export type ActionType = (typeof actionTypes)[number];

export const actionTypeLabels: Record<ActionType, string> = {
  approved: 'Approved',
  removed: 'Removed',
  reinstated: 'Reinstated'
};

export const roleTypes = ['super-admin', 'support', 'user'] as const;

export type RoleType = (typeof roleTypes)[number];

export const roleLabels: Record<RoleType, string> = {
  'super-admin': 'Super Admin',
  support: 'Support',
  user: 'User'
};
