export const moderationInboxTabs = [
  'inbox',
  'removed',
  'open_appeals'
] as const;

export type ModerationInboxTabs = (typeof moderationInboxTabs)[number];

export const BASE_LISTING_CLASS =
  'mt-1 h-8 w-full justify-center px-0 text-xs font-medium underline-offset-4 hover:underline';
