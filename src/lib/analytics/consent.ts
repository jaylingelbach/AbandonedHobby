export const CONSENT_KEY = 'cookie_consent';
export const CONSENT_EVENT = 'cookie-consent-change';

export type ConsentValue = 'accepted' | 'necessary' | 'declined';

export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(CONSENT_KEY);
  if (value === 'accepted' || value === 'necessary' || value === 'declined')
    return value;
  return null;
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
