import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface NavbarItem {
  href: string;
  children: React.ReactNode;
}

interface Props {
  items: NavbarItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthed: boolean; // 👈 new
  unreadCount?: number; // 👈 new
}

export const NavbarSidebar = ({
  items,
  open,
  onOpenChange,
  isAuthed,
  unreadCount = 0
}: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 transition-none">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex flex-col overflow-y-auto h-full pb-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
              onClick={() => onOpenChange(false)}
            >
              {item.children}
            </Link>
          ))}

          <div className="border-t">
            {isAuthed ? (
              <>
                <Link
                  href="/inbox"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center justify-between text-base font-medium"
                  onClick={() => onOpenChange(false)}
                  aria-label={
                    unreadCount > 0 ? `Inbox (${unreadCount} unread)` : 'Inbox'
                  }
                >
                  <span>Inbox</span>
                  {unreadCount > 0 && (
                    <span
                      className={cn(
                        'ml-2 inline-flex min-w-[1.25rem] h-5 items-center justify-center rounded-full px-1 text-xs font-semibold bg-red-600 text-white',
                        unreadCount > 9 ? 'text-[0.55rem]' : ''
                      )}
                    >
                      {unreadCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium"
                  onClick={() => onOpenChange(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
