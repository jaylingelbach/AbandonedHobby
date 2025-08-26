'use client';

import Link from 'next/link';
import { Poppins } from 'next/font/google';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTRPC } from '@/trpc/client';
import z from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { loginSchema } from '../../schemas';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['700']
});

function SignInView() {
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const resend = async (email: string) => {
    try {
      const res = await fetch('/api/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        toast.success('If an account exists, a new verification email was sent.');
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? 'Could not resend verification email.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    }
  };

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    login.mutate(values);
  };

  const login = useMutation(
    trpc.auth.login.mutationOptions({
      onError: (error) => {
        const message = error.message;
        if (message.includes('verify')) {
          toast.error('Please verify your email to continue.', {
            duration: Infinity,
            action: {
              label: 'Resend link',
              onClick: () => resend(form.getValues('email'))
            },
            closeButton: true
          });
        } else {
          toast.error(error.message);
        }
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.auth.session.queryFilter());
        toast.success('Successfully logged in!');
        router.push('/');
      }
    })
  );

  const form = useForm<z.infer<typeof loginSchema>>({
    mode: 'all',
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5">
      <div className="bg-[#F4F4F0] h-screen w-full lg:col-span-3 overflow-y-auto">
        <Form {...form}>
          {/* form.handleSubmit enfores the validation from our schema */}
          <form
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit(onSubmit)(e);
            }}
            className="flex flex-col gap-8 p-4 lg:p-16"
          >
            <div className="flex items-center justify-between mb-8">
              <Link href="/">
                <span
                  className={cn('text-2xl font-semibold', poppins.className)}
                >
                  Abandoned Hobby
                </span>
              </Link>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-base border-none underline"
              >
                <Link prefetch href="/sign-up">
                  Sign-up
                </Link>
              </Button>
            </div>
            <h1 className="text-4xl font-medium">
              Welcome back to Abandoned Hobby!
            </h1>
            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Email</FormLabel>
                  <FormControl>
                    {/* spreading the field ensures you have all the things like onChange onBlur and state */}
                    <Input {...field} autoComplete="email" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      {/* spreading the field ensures you have all the things like onChange onBlur and state */}
                      <Input
                        {...field}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="pr-12"
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      onMouseDown={(e) =>
                        e.preventDefault()
                      } /* keep cursor focus in input */
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-2 my-auto h-8 rounded px-2"
                    >
                      {showPassword ? (
                        <Eye className="cursor-pointer" />
                      ) : (
                        <EyeOff className="cursor-pointer" />
                      )}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              disabled={login.isPending}
              type="submit"
              size="lg"
              variant="elevated"
              className="bg-black text-white hover:bg-pink-400 hover:text-primary"
            >
              Login
            </Button>
            <Button
              asChild
              variant="link"
              size="sm"
              className="text-base border-none underline justify-end w-full"
            >
              <Link href="/admin/forgot">forgot password?</Link>
            </Button>
          </form>
        </Form>
      </div>
      <div
        className="h-screen w-full lg:col-span-2 hidden lg:block"
        style={{
          backgroundImage: "url('/auth-bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
    </div>
  );
}

export default SignInView;
