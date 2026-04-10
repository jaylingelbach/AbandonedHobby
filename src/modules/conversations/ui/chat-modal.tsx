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

/**
 * Renders a modal dialog containing a chat UI for a specific conversation and room.
 *
 * @param open - Whether the dialog is visible
 * @param onOpenChange - Callback invoked with the new open state when the dialog is opened or closed
 * @param conversationId - Identifier for the conversation displayed in the chat
 * @param roomId - Identifier for the chat room used by the embedded chat UI
 * @param username - Display name shown in the dialog title
 * @returns A Dialog element that houses the chat interface and accessibility metadata
 */
export function ChatModal({
  open,
  onOpenChange,
  conversationId,
  roomId,
  username
}: ChatModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
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

        <div className="flex-1 min-h-0">
          <ChatRoom conversationId={conversationId} roomId={roomId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
