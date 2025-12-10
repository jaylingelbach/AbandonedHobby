import { InboxIcon } from 'lucide-react';

type MessageCardProps = {
  message: string;
  onRetry: () => void;
};
export const MessageCard = ({ message, onRetry }: MessageCardProps) => {
  return (
    <div className="border border-black border-dashed flex items-center justify-center p-8 flex-col gap-4 bg-white w-full rounded-lg">
      <InboxIcon />
      <p className="text-sm font-medium">{message}</p>
      <button className="underline text-sm" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
};

export default MessageCard;
