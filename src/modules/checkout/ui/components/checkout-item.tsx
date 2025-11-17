import Image from 'next/image';
import Link from 'next/link';
import { MinusIcon, PlusIcon } from 'lucide-react';

import { cn, formatCurrency } from '@/lib/utils';

interface CheckoutItemProps {
  isLast?: boolean;
  imageURL?: string | null;
  name: string;
  productURL: string;
  tenantURL: string;
  tenantName: string;
  price: number; // dollars
  quantity: number;
  onQuantityChange: (next: number) => void;
  onRemove: () => void;
}

export const CheckoutItem = ({
  isLast,
  imageURL,
  name,
  productURL,
  tenantURL,
  tenantName,
  price,
  quantity,
  onQuantityChange,
  onRemove
}: CheckoutItemProps) => {
  const unitPrice = typeof price === 'number' ? price : 0;
  const lineTotal = unitPrice * (quantity || 1);
  const canDecrement = quantity > 1;

  const handleDecrement = () => {
    if (!canDecrement) return;
    onQuantityChange(quantity - 1);
  };

  const handleIncrement = () => {
    onQuantityChange(quantity + 1);
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[8.5rem_1fr_auto] gap-4 pr-4 border-b',
        isLast && 'border-b-0'
      )}
    >
      {/* Image */}
      <div className="overflow-hidden border-r">
        <div className="relative aspect-square h-full">
          <Image
            src={imageURL || '/placeholder.png'}
            alt={`Product: ${name} from ${tenantName}`}
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* Name + Tenant */}
      <div className="py-4 flex flex-col justify-between">
        <div>
          <Link href={productURL}>
            <h4 className="font-bold underline">{name}</h4>
          </Link>
          <Link href={tenantURL}>
            <h4 className="font-medium underline">{tenantName}</h4>
          </Link>
        </div>
      </div>

      {/* Price, quantity, subtotal, remove */}
      <div className="py-4 flex flex-col justify-between items-end gap-2">
        {/* Unit price */}
        <h4 className="font-medium">{formatCurrency(unitPrice)}</h4>

        {/* Quantity controls */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Qty</span>
          <button
            type="button"
            onClick={handleDecrement}
            disabled={!canDecrement}
            aria-label={`Decrease quantity of ${name}`}
            className={cn(
              'h-7 w-7 inline-flex items-center justify-center rounded-full border text-xs',
              !canDecrement && 'opacity-50 cursor-not-allowed'
            )}
          >
            <MinusIcon className="h-3 w-3" />
          </button>
          <span className="w-6 text-center font-medium">{quantity}</span>
          <button
            type="button"
            onClick={handleIncrement}
            aria-label={`Increase quantity of ${name}`}
            className="h-7 w-7 inline-flex items-center justify-center rounded-full border text-xs"
          >
            <PlusIcon className="h-3 w-3" />
          </button>
        </div>

        {/* Line subtotal */}
        <div className="text-right text-xs text-muted-foreground">
          Line total:{' '}
          <span className="font-semibold">{formatCurrency(lineTotal)}</span>
        </div>

        {/* Remove */}
        <button
          aria-label={`Remove ${name} from cart`}
          className="underline font-medium cursor-pointer text-xs"
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
    </div>
  );
};

export default CheckoutItem;
