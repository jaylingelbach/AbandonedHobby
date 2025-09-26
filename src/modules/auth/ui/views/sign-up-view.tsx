'use client';



import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { Poppins } from 'next/font/google';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn, getSafeNextURL } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

import { registerSchema } from '../../schemas';

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] });

function SignUpView() {
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next') ?? null;

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Use the typed tRPC hook directly (simpler & avoids brace mixups)
  const register = useMutation(
    trpc.auth.register.mutationOptions({
      onError: (error) => {
        toast.error(error.message);
      },
      onSuccess: async (res) => {
        await queryClient.invalidateQueries(trpc.auth.session.queryFilter());
        toast.success(
          'Account created. Check your email to verify, then sign in.'
        );

        if (res?.returnTo) {
          const safe = getSafeNextURL(res.returnTo);
          if (safe) {
            if (safe.hostname !== window.location.hostname) {
              window.location.replace(safe.toString());
            } else {
              router.replace(`${safe.pathname}${safe.search}${safe.hash}`);
            }
            return;
          }
        }
      }
    })
  );

  const form = useForm<z.infer<typeof registerSchema>>({
    mode: 'all',
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      username: ''
    }
  });

  const onSubmit = (values: z.infer<typeof registerSchema>) => {
    register.mutate(values);
  };

  const username = form.watch('username');
  const usernameErrors = form.formState.errors.username;
  const showPreview = !!username && !usernameErrors;

  const signInHref = rawNext
    ? `/sign-in?next=${encodeURIComponent(rawNext)}`
    : '/sign-in';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5">
      <div className="bg-[#F4F4F0] h-screen w-full lg:col-span-3 overflow-y-auto">
        <Form {...form}>
          {/* form.handleSubmit enforces the validation from our schema */}
          <form
            onSubmit={form.handleSubmit(onSubmit)}
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
                <Link href={signInHref}>Sign in</Link>
              </Button>
            </div>

            <h1 className="text-4xl font-medium">
              {`Join other ADHDers and neurodivergents buying selling and trading each other's abandoned hobbies.`}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">First Name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="given-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="family-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Username</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="username" />
                  </FormControl>
                  <FormDescription
                    className={cn('hidden', showPreview && 'block')}
                  >
                    Your account/store will be available at{' '}
                    <strong>{username}</strong>.abandonedhobby.com
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">Email</FormLabel>
                  <FormControl>
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
                      <Input
                        {...field}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="pr-12"
                      />
                    </FormControl>
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 my-auto h-8 rounded px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => setShowPassword((v) => !v)}
                      onMouseDown={(e) => e.preventDefault()} // keep cursor in input
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      aria-pressed={showPassword}
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
              disabled={register.isPending}
              type="submit"
              size="lg"
              variant="elevated"
              className="bg-black text-white hover:bg-pink-400 hover:text-primary"
            >
              Create Account
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

export default SignUpView;
