'use client';
import { useEffect } from 'react';

export default function ForceLightThemeProvider({
  children
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const el = document.documentElement;
    if (el.getAttribute('data-theme') !== 'light')
      el.setAttribute('data-theme', 'light');

    // If Payload toggler exists, keep correcting it
    const observer = new MutationObserver(() => {
      if (el.getAttribute('data-theme') !== 'light')
        el.setAttribute('data-theme', 'light');
    });
    observer.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return children as React.ReactElement;
}
