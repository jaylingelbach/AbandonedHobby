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
  // If there’s only 0 or 1 available, we don’t render the picker at all.
  // The “big Add to cart” alone is the UX in that case.
  if (quantityAvailable <= 1) {
    return null;
  }

  const canIncrement = quantity + 1 <= quantityAvailable;
  const canDecrement = quantity > 1;

  const handleDecrement = () => {
    if (!canDecrement) return;
    onChange(Math.max(1, quantity - 1));
  };

  const handleIncrement = () => {
    if (!canIncrement) return;
    onChange(quantity + 1);
  };

  return (
    <div className="flex flex-1 gap-4">
      <ButtonGroup>
        <Button
          disabled={!canDecrement}
          onClick={handleDecrement}
          size="lg"
          variant="outline"
        >
          <MinusIcon />
        </Button>

        <ButtonGroupText className="min-w-12 justify-center">
          {quantity}
        </ButtonGroupText>

        <Button
          disabled={!canIncrement}
          onClick={handleIncrement}
          size="lg"
          variant="outline"
        >
          <PlusIcon />
        </Button>
      </ButtonGroup>
    </div>
  );
};

export default QuantityPicker;
