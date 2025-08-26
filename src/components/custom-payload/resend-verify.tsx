'use client';
import { useState } from 'react';

export function ResendVerify() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  const onResend = async () => {
    try {
      const res = await fetch('/api/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email to resend verification"
        />
        <button type="button" onClick={onResend}>
          Resend
        </button>
      </div>
      {status === 'sent' && <p>Check your inbox for a new link.</p>}
      {status === 'error' && <p>Couldn’t resend. Try again later.</p>}
    </div>
  );
}
