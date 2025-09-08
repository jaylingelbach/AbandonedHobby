'use client';

import { useOnboardingBanner } from '@/hooks/use-onboarding-banner';

export function OnboardingBannerAdmin() {
  const {
    isLoading,
    isError,
    shouldShow,
    label,
    next,
    dismissForever,
    dismissOnce,
    isDismissing
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
          rel="noreferrer"
        >
          Continue
        </a>
        <button
          className="ah-onboarding-btn"
          onClick={dismissOnce}
          disabled={isDismissing}
          aria-label="Dismiss"
        >
          ✕
        </button>
        <button
          className="ah-onboarding-btn"
          onClick={dismissForever}
          disabled={isDismissing}
        >
          Don’t show again
        </button>
      </div>
    </div>
  );
}

export default OnboardingBannerAdmin;
