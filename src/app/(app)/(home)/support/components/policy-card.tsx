import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PolicyCard() {
  return (
    <Card
      id="policies"
      className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]"
    >
      <CardHeader>
        <CardTitle className="text-xl font-black">Policies & Safety</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-xl border-4 border-black bg-yellow-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Ship-by window</h3>
          <p>
            Tracking must be provided within <strong>3 business days</strong>.
          </p>
        </div>
        <div className="rounded-xl border-4 border-black bg-cyan-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Buyer escalation</h3>
          <p>
            Allowed after <strong>48 hours</strong> of seller no-response.
          </p>
        </div>
        <div className="rounded-xl border-4 border-black bg-emerald-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Return window</h3>
          <p>
            Claims for damaged/SNAD within <strong>7 days</strong> of delivery.
          </p>
        </div>
        <div className="rounded-xl border-4 border-black bg-rose-100 p-3 shadow-[6px_6px_0_#000]">
          <h3 className="font-extrabold">Counterfeits & safety</h3>
          <p>Zero tolerance; listings removed, accounts reviewed.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          These are platform-wide minimums—sellers may offer better terms but
          not worse.
        </p>
      </CardContent>
    </Card>
  );
}
