import { TermsClient } from './terms-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return <TermsClient />;
}
