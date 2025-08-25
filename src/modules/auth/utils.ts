import { cookies as getCookies } from 'next/headers';

interface Props {
  prefix: string;
  value: string;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value));
}

export const generateAuthCookie = async ({ prefix, value }: Props) => {
  const cookies = await getCookies();
  cookies.set({
    name: `${prefix}-token`,
    value: value,
    httpOnly: true,
    path: '/',
    sameSite: process.env.NEXT_PUBLIC_ROOT_DOMAIN ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...(process.env.NEXT_PUBLIC_ROOT_DOMAIN
      ? { domain: process.env.NEXT_PUBLIC_ROOT_DOMAIN }
      : {}),
    maxAge: 60 * 60 * 24 * 7
  });
};
