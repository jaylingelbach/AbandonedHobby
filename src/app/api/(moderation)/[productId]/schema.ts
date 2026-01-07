import { moderationFlagReasons } from '@/constants';
import { z } from 'zod';

export const moderationRequestSchema = z
  .object({
    reason: z.enum(moderationFlagReasons),
    otherText: z.string().trim().optional()
  })
  .refine(
    (data) =>
      data.reason !== 'other' ||
      (typeof data.otherText === 'string' && data.otherText.length >= 10),
    {
      path: ['otherText'],
      message: 'Please provide at least 10 characters of detail for “Other”.'
    }
  );

export type ModerationRequest = z.infer<typeof moderationRequestSchema>;

export const moderationApproveSchema = z.object({
  moderationNote: z.string().trim().optional()
});

export type ModerationApprove = z.infer<typeof moderationApproveSchema>;

export const moderationRemoveSchema = z.object({
  moderationNote: z.string().trim().optional()
});

export type ModerationRemove = z.infer<typeof moderationRemoveSchema>;
