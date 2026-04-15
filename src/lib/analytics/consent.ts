export const CONSENT_KEY = 'cookie_consent';
export const CONSENT_EVENT = 'cookie-consent-change';

export type ConsentValue = 'accepted' | 'necessary' | 'declined';

export function getConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    if (value === 'accepted' || value === 'necessary' || value === 'declined')
      return value;
  } catch {
    // localStorage blocked (private browsing, sandboxed iframe, quota exceeded)
  }
  return null;
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage blocked -- still dispatch so the current session responds
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
