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
  bgClass:
    | 'bg-blue-50'
    | 'bg-green-50'
    | 'bg-purple-50'
    | 'bg-orange-50'
    | 'bg-red-50'; // tailwind bg- color class.
}
