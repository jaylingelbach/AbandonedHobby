import { User } from '@/payload-types';

export type LastMsg = {
  id: string;
  content: string;
  createdAtISO: string;
  senderId: string;
};
export type LastGroup = {
  _id: string;
  doc: {
    _id: string;
    content?: string;
    createdAt?: string | Date;
    sender?: string | User;
    conversationId?: string;
  };
};

export type UnreadGroup = { _id: string; count: number };
