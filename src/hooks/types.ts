import { z } from 'zod';

export const OnboardingStepEnum = z.enum([
  'verify-email',
  'create-tenant',
  'connect-stripe',
  'list-first-product',
  'dashboard'
]);
export type OnboardingStep = z.infer<typeof OnboardingStepEnum>;

/** UI prefs stored on the user doc. Extendable via .passthrough() */
export const UIStateSchema = z
  .object({
    onboardingDismissedStep: OnboardingStepEnum.optional(),
    hideOnboardingBanner: z.boolean().optional()
  })
  .passthrough();

export type UIState = z.infer<typeof UIStateSchema>;
