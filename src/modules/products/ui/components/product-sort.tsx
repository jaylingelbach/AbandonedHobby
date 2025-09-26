'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useProductFilters } from '../../hooks/use-product-filters';

type SortOption = 'curated' | 'trending' | 'hot_and_new';
interface SortButtonProps {
  option: SortOption;
  currentSort: SortOption;
  label: string;
  onSelect: (option: SortOption) => void;
}

const SortButton = ({
  option,
  currentSort,
  label,
  onSelect
}: SortButtonProps) => (
  <Button
    size="sm"
    className={cn(
      'rounded-full bg-white hover:bg-white',
      currentSort !== option &&
        'bg-transparent border-transparent hover:border-border hover:bg-transparent'
    )}
    variant="secondary"
    aria-pressed={currentSort === option}
    onClick={() => onSelect(option)}
  >
    {label}
  </Button>
);

export const ProductSort = () => {
  const [filters, setFilters] = useProductFilters();
  const handleSelect = (option: SortOption) => setFilters({ sort: option });

  return (
    <div className="flex items-center gap-2">
      <SortButton
        option="curated"
        currentSort={filters.sort}
        label="Curated"
        onSelect={handleSelect}
      />
      <SortButton
        option="trending"
        currentSort={filters.sort}
        label="Trending"
        onSelect={handleSelect}
      />
      <SortButton
        option="hot_and_new"
        currentSort={filters.sort}
        label="Hot & New"
        onSelect={handleSelect}
      />
    </div>
  );
};
