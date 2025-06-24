// src/lib/get-auth-user.ts
import { getServerAuthSession } from './auth'; // however you get your user from req

export async function getAuthUser(req: any) {
  const session = await getServerAuthSession(req);
  return session?.user || null;
}
