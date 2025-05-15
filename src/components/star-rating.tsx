import { StarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

const MAX_RATING = 5;
const MIN_RATING = 0;

interface StarRatingProps {
  rating: number;
  className?: string;
  iconClassName?: string;
  text?: string;
  ariaLabel?: string;
}
export const StarRating = ({
  rating,
  className,
  iconClassName,
  text,
  ariaLabel
}: StarRatingProps) => {
  const safeRating = Math.max(MIN_RATING, Math.min(rating, MAX_RATING));
  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="img"
      aria-label={
        ariaLabel || `Rating: ${safeRating} out of ${MAX_RATING} stars`
      }
    >
      {Array.from({ length: MAX_RATING }).map((_, index) => (
        <StarIcon
          key={index}
          className={cn(
            'size-4',
            index < safeRating ? 'fill-black' : '',
            iconClassName
          )}
          aria-hidden="true"
        />
      ))}
      {text && <p>{text}</p>}
    </div>
  );
};

export default StarRating;
