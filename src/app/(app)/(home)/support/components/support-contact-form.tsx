import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function SupportContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [topic, setTopic] = useState('Order');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    // TODO: Wire this to your endpoint (e.g., /api/support). This is a friendly stub.
    try {
      const payload = Object.fromEntries(form.entries());
      console.log('Support form payload', payload);
      alert("Thanks! We've received your message and will reply by email.");
      (e.currentTarget as HTMLFormElement).reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-bold">I am a</label>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setRole('buyer')}
              variant={role === 'buyer' ? 'default' : 'secondary'}
              className={`rounded-xl border-4 border-black shadow-[4px_4px_0_#000] ${role === 'buyer' ? 'bg-yellow-300' : 'bg-white'}`}
              aria-pressed={role === 'buyer'}
            >
              Buyer
            </Button>
            <Button
              type="button"
              onClick={() => setRole('seller')}
              variant={role === 'seller' ? 'default' : 'secondary'}
              className={`rounded-xl border-4 border-black shadow-[4px_4px_0_#000] ${role === 'seller' ? 'bg-cyan-300' : 'bg-white'}`}
              aria-pressed={role === 'seller'}
            >
              Seller
            </Button>
          </div>
          <input type="hidden" name="role" value={role} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="topic">
            Topic
          </label>
          <select
            id="topic"
            name="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-10 w-full rounded-xl border-4 border-black bg-white px-3 shadow-[4px_4px_0_#000] focus:outline-none"
          >
            <option>Order</option>
            <option>Listing</option>
            <option>Payout</option>
            <option>Account</option>
            <option>Bug</option>
            <option>Abuse/Report</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="ref">
            Order ID / Listing URL
          </label>
          <Input
            id="ref"
            name="reference"
            placeholder="#12345 or https://…"
            className="rounded-xl border-4 border-black shadow-[4px_4px_0_#000]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="email">
            Contact email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="rounded-xl border-4 border-black shadow-[4px_4px_0_#000]"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold" htmlFor="desc">
          What happened? What outcome do you expect?
        </label>
        <Textarea
          id="desc"
          name="description"
          required
          rows={5}
          className="rounded-2xl border-4 border-black shadow-[4px_4px_0_#000]"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: include photos of the item, packaging, and label—this speeds
          things up.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          By submitting you agree to our{' '}
          <Link className="underline" href="/terms">
            Terms
          </Link>{' '}
          and{' '}
          <Link className="underline" href="/privacy">
            Privacy Policy
          </Link>
          .
        </div>
        <Button
          type="submit"
          disabled={submitting}
          className="rounded-2xl border-4 border-black bg-black text-white shadow-[6px_6px_0_#000] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[4px_4px_0_#000]"
        >
          {submitting ? 'Sending…' : 'Send message'}
        </Button>
      </div>
    </form>
  );
}
