'use client';

import { useMutation } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useTRPC } from '@/trpc/client';

const Page = () => {
  const router = useRouter();
  const trpc = useTRPC();
  const { mutate: verify } = useMutation(
    trpc.checkout.verify.mutationOptions({
      onSuccess: (data) => {
        if (data?.url) {
          window.location.assign(data.url);
        } else {
          router.replace('/');
        }
      },
      onError: () => {
        router.replace('/');
      }
    })
  );

  // used to prevent getting called twice in dev
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    verify();
  }, [verify]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderIcon className="animate-spin text-muted-foreground" />
    </div>
  );
};

export default Page;
