import { getPayload } from 'payload';

import config from '@payload-config';

import type { NextApiRequest } from 'next';

export async function getServerTRPCContext(req: NextApiRequest) {
  // 1) Initialize Payload (only needs your config)
  const payload = await getPayload({ config });

  // 2) Wrap Next.js headers in a WHATWG Headers to satisfy Payload
  const hdrs = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        hdrs.append(key, v);
      }
    } else if (value != null) {
      hdrs.append(key, value);
    }
  }

  // 3) Authenticate using the wrapped Headers object
  const session = await payload.auth({ headers: hdrs });

  return {
    db: payload,
    session,
    userId: session.user?.id ?? null
  };
}
