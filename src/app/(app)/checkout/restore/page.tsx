import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false } };

/**
 * Renders the restore page heading.
 *
 * @returns A JSX element containing an `<h1>restore page</h1>` heading.
 */
export default function Page() {
  return <h1>restore page</h1>;
}
