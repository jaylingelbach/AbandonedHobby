import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false } };

export default function Page() {
  return <h1>restore page</h1>;
}
