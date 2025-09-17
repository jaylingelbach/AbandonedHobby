import 'server-only';
import type { Payload } from 'payload';
import { getPayload } from 'payload';
import config from '@payload-config';

let _payload: Promise<Payload> | null = null;

export function getPayloadClient(): Promise<Payload> {
  if (!_payload) _payload = getPayload({ config });
  return _payload;
}
