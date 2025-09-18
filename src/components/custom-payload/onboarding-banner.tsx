'use client';

import { useOnboardingBanner } from '@/hooks/use-onboarding-banner';

/**
 * Renders the admin onboarding banner (or its loading skeleton) and provides controls to continue or dismiss.
 *
 * Uses the `useOnboardingBanner` hook to determine state. When loading, renders an accessible skeleton. If the hook reports an error or that the banner should not be shown, nothing is rendered. Otherwise the banner displays a "Continue" link (opens in a new tab), a one-time dismiss button, a permanent "Don't show again" dismiss button, and — when present — an inline dismiss error message.
 *
 * Accessibility: the banner is exposed as a region with an appropriate aria-label; the loading skeleton uses role="status" and aria-busy; inline dismiss errors are announced via aria-live="polite".
 *
 * @returns A JSX element containing the banner or skeleton, or `null` when nothing should be rendered.
 */
export function OnboardingBannerAdmin() {
  const {
    isLoading,
    isError,
    shouldShow,
    label,
    next,
    dismissForever,
    dismissOnce,
    isDismissing,
    dismissError
  } = useOnboardingBanner();

  if (isError) return null;

  if (isLoading) {
    return (
      <div
        className="ah-onboarding-banner ah-onboarding-skel"
        role="status"
        aria-busy="true"
      >
        <div className="ah-onboarding-left">
          <div className="ah-skel ah-skel-text" style={{ width: 180 }} />
          <div className="ah-skel ah-skel-pill" />
        </div>
        <div className="ah-skel ah-skel-btn" />
      </div>
    );
  }

  if (!shouldShow) return null;

  return (
    <div
      className="ah-onboarding-banner"
      role="region"
      aria-label="Finish getting set up"
      aria-busy={isDismissing ? 'true' : undefined}
    >
      <div className="ah-onboarding-left">
        <span>Finish getting set up</span>
        {label ? (
          <span className="ah-onboarding-badge">Next: {label}</span>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a
          className="ah-onboarding-btn"
          href={next ?? '/welcome'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Continue
        </a>
        <button
          className="ah-onboarding-btn"
          onClick={dismissOnce}
          disabled={isDismissing}
          type="button"
          aria-label="Dismiss"
        >
          ✕
        </button>
        <button
          className="ah-onboarding-btn"
          onClick={dismissForever}
          disabled={isDismissing}
          type="button"
          aria-label="Dismiss forever"
        >
          Don’t show again
        </button>
        {dismissError && (
          <p
            className="text-sm text-red-600 mt-2"
            role="status"
            aria-live="polite"
          >
            {dismissError instanceof Error
              ? dismissError.message
              : 'Could not update your preference.'}
          </p>
        )}
      </div>
    </div>
  );
}

export default OnboardingBannerAdmin;
