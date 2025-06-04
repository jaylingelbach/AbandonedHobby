import { cookies as getCookies } from 'next/headers';

interface Props {
  prefix: string;
  value: string;
}

export const generateAuthCookie = async ({ prefix, value }: Props) => {
  const cookies = await getCookies();
  cookies.set({
    name: `${prefix}-token`,
    value: value,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7
    // TODO: ensure cross domain cookie sharing.
    // sameSite: 'none',
    // domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    // secure: process.env.NODE_ENV === 'production'
  });
};
