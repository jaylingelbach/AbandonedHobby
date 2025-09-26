import 'server-only';
import { getPayload } from 'payload';

import config from '@payload-config';

import type { Payload } from 'payload';

let _payload: Promise<Payload> | null = null;

export function getPayloadClient(): Promise<Payload> {
  if (!_payload) {
    _payload = getPayload({ config });
    // If initialization fails once, allow subsequent calls to retry.
    _payload.catch(() => {
      _payload = null;
    });
  }
  return _payload;
}
