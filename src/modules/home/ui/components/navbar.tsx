import { useState } from 'react';
import Link from 'next/link';
import { Inbox, MenuIcon } from 'lucide-react';
import { Poppins } from 'next/font/google';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NavbarSidebar } from './navbar-sidebar';

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] });

const navbarItems = [
  { href: '/', children: 'Home' },
  { href: '/about', children: 'About' },
  { href: '/features', children: 'Features' },
  { href: '/pricing', children: 'Pricing' },
  { href: '/support', children: 'Support' }
];

export const Navbar = () => {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const trpc = useTRPC();

  // only run queries in
  const isClient = typeof window !== 'undefined';

  // Gate the session query to client only
  const session = useQuery({
    ...trpc.auth.session.queryOptions(),
    enabled: isClient,
    // optional hardening:
    retry: 0,
    staleTime: 30_000
  });

  const isAuthed = !!session.data?.user;

  // Gate unreadCount to client AND only when authenticated
  const notificationsQuery = useQuery({
    ...trpc.notifications.unreadCount.queryOptions(),
    enabled: isClient && isAuthed,
    retry: 0,
    staleTime: 30_000
  });

  const rawCount = notificationsQuery.data as
    | number
    | { totalDocs: number }
    | undefined;
  const unreadCount =
    typeof rawCount === 'number' ? rawCount : (rawCount?.totalDocs ?? 0);

  return (
    <nav className="h-20 flex border-b justify-between font-medium bg-white">
      <Link href="/" className="pl-6 flex items-center">
        <span className={cn('text-2xl font-semibold', poppins.className)}>
          Abandoned Hobby
        </span>
      </Link>

      <NavbarSidebar
        items={navbarItems}
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
      />

      <div className="items-center gap-4 hidden lg:flex">
        {navbarItems.map((item) => (
          <Button
            key={item.href}
            asChild
            variant="outline"
            className={cn(
              'bg-transparent hover:bg-transparent rounded-full hover:border-primary border-transparent px-3.5 text-lg',
              pathname === item.href &&
                'bg-black text-white hover:bg-black hover:text-white'
            )}
          >
            <Link href={item.href}>{item.children}</Link>
          </Button>
        ))}
      </div>

      {isAuthed ? (
        <div className="hidden lg:flex">
          <div className="items-center gap-4 hidden lg:flex">
            <Button
              asChild
              variant="outline"
              className="relative rounded-full p-2"
              aria-label={`Inbox${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
              <Link href="/inbox">
                <Inbox className="size-6" />
                {unreadCount > 0 && (
                  <span
                    aria-live="polite"
                    aria-label={`${unreadCount} unread messages`}
                    className={cn(
                      'absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white',
                      unreadCount > 9 ? 'text-[0.55rem]' : ''
                    )}
                  >
                    {unreadCount}
                  </span>
                )}
              </Link>
            </Button>

            <Button
              asChild
              variant="secondary"
              className="border-l border-t border-b-0 border-r-0 px-12 h-full rounded-none bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
            >
              <Link href="/admin">Dashboard</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex">
          <Button
            asChild
            variant="secondary"
            className="border-l border-t border-b-0 border-r-0 px-12 h-full rounded-none bg-white hover:bg-pink-400 transition-colors text-lg"
          >
            <Link prefetch href="/sign-in">
              Login
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="border-l border-t border-b-0 border-r-0 px-12 h-full rounded-none bg-black text-white hover:bg-pink-400 hover:text-black transition-colors text-lg"
          >
            <Link prefetch href="/sign-up">
              Sign up
            </Link>
          </Button>
        </div>
      )}

      <div className="flex lg:hidden items-center justify-items-center">
        <Button
          variant="ghost"
          className="size-12 border-transparent bg-white"
          onClick={() => setIsSidebarOpen(true)}
        >
          <MenuIcon />
        </Button>
      </div>
    </nav>
  );
};
