import { ReactElement } from 'react';

export interface FaqItem {
  id: string;
  question: string;
  // Keep answers flexible for small rich fragments while still typed
  answer: string | ReactElement;
}

export interface Callout {
  id: string;
  title: string;
  body: string;
  icon: 'card' | 'wallet' | 'receipt';
  bgClass: 'bg-blue-200' | 'bg-purple-200' | 'bg-red-200'; // tailwind bg- color class.
}
