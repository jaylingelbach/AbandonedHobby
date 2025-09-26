import { z } from 'zod';

import { ONBOARDING_STEPS } from '@/modules/onboarding/types';

export const OnboardingStepEnum = z.enum(ONBOARDING_STEPS);

export type OnboardingStep = z.infer<typeof OnboardingStepEnum>;

/** UI prefs stored on the user doc. Extendable via .passthrough() */
export const UIStateSchema = z
  .object({
    onboardingDismissedStep: OnboardingStepEnum.optional(),
    hideOnboardingBanner: z.boolean().optional()
  })
  .passthrough();

export type UIState = z.infer<typeof UIStateSchema>;
