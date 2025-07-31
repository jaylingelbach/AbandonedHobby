'use client';

import { House } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function BackToRootLink() {
  const [rootUrl, setRootUrl] = useState<string | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol;
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    if (rootDomain) {
      setRootUrl(`${protocol}//${rootDomain}`);
    }
  }, []);

  if (!rootUrl) return null;

  return (
    <div className="flex items-center">
      <a href={rootUrl}>
        <House className="h-5 w-5 transition-colors" />
      </a>
    </div>
  );
}
