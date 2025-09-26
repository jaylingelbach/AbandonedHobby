import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { ChatRoom } from '@/modules/messages/ui/chat-room';

interface ChatModalProps {
  open: boolean;
  onOpenChange: (val: boolean) => void;
  conversationId: string;
  roomId: string;
  username: string;
}

export function ChatModal({
  open,
  onOpenChange,
  conversationId,
  roomId,
  username
}: ChatModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh]">
        <DialogHeader className="flex justify-between items-center mb-2">
          <DialogTitle>Chat with {username}</DialogTitle>
          <VisuallyHidden>
            {/* Hidden but accessible title */}
            <DialogTitle>Chat dialog for conversation with seller</DialogTitle>
          </VisuallyHidden>
          {/* <Button
            variant="link"
            className="text-sm"
            onClick={() => {
              router.push(`/chat/${conversationId}`);
              onOpenChange(false);
            }}
          >
            Open full view →
          </Button> */}
        </DialogHeader>

        <DialogDescription className="sr-only">
          This dialog allows you to chat with the seller about the product.
        </DialogDescription>

        <ChatRoom conversationId={conversationId} roomId={roomId} />
      </DialogContent>
    </Dialog>
  );
}
