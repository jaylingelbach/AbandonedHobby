export const CONSENT_KEY = 'cookie_consent';
export const CONSENT_EVENT = 'cookie-consent-change';

export type ConsentValue = 'accepted' | 'necessary' | 'declined';

/**
 * Retrieve the user's cookie consent state from browser storage when available.
 *
 * @returns The consent value `'accepted'`, `'necessary'`, or `'declined'` if found and valid; `null` if not available, invalid, or when not running in a browser.
 */
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

/**
 * Persist the user's cookie consent state and notify the page of the change.
 *
 * Stores the provided consent under CONSENT_KEY in localStorage (storage errors are ignored)
 * and dispatches a CustomEvent named CONSENT_EVENT whose `detail` is the new consent value.
 *
 * @param value - The consent state to set: 'accepted', 'necessary', or 'declined'
 */
export function setConsent(value: ConsentValue): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage blocked -- still dispatch so the current session responds
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
