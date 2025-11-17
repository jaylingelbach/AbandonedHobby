'use client';

import { MinusIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';

export const title = 'Quantity Picker';

interface Props {
  onChange: (next: number) => void;
  quantity: number;
  quantityAvailable: number;
}

const QuantityPicker = ({ quantity, quantityAvailable, onChange }: Props) => {
  if (process.env.NODE_ENV === 'development') {
    if (quantity < 1 || quantity > quantityAvailable) {
      console.warn(
        `QuantityPicker: quantity (${quantity}) is outside valid bounds [1, ${quantityAvailable}]`
      );
    }
  }
  if (quantityAvailable <= 1) return null;

  const canIncrement = quantity + 1 <= quantityAvailable;
  const canDecrement = quantity > 1;

  const handleDecrement = () => {
    if (!canDecrement) return;
    onChange(quantity - 1);
  };

  const handleIncrement = () => {
    if (!canIncrement) return;
    onChange(quantity + 1);
  };

  return (
    <div className="flex shrink-0">
      <ButtonGroup className="h-10">
        <Button
          aria-label="Decrease quantity"
          disabled={!canDecrement}
          onClick={handleDecrement}
          size="sm"
          variant="outline"
        >
          <MinusIcon className="size-4" />
        </Button>

        <ButtonGroupText className="min-w-10 justify-center text-sm">
          {quantity}
        </ButtonGroupText>

        <Button
          aria-label="Increase quantity"
          disabled={!canIncrement}
          onClick={handleIncrement}
          size="sm"
          variant="outline"
        >
          <PlusIcon className="size-4" />
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default QuantityPicker;
