import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SellerTipsCard() {
  return (
    <Card className="rounded-3xl border-4 border-black bg-white shadow-[10px_10px_0_#000]">
      <CardHeader>
        <CardTitle className="text-xl font-black">
          Shipping & Returns tips
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <ul className="list-disc pl-5">
          <li>Use sturdy boxes; pad corners for heavier gear.</li>
          <li>Always photograph item condition & packing before sealing.</li>
          <li>Add tracking within 3 business days to avoid penalties.</li>
          <li>
            Process refunds within the order page to keep records aligned.
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
