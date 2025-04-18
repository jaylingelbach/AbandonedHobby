'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import debounce from 'lodash/debounce';

import { Button } from '@/components/ui/button';
import { Category } from '@/payload-types';
import { SubcategoryMenu } from './subcategory-menu';
import { useDropdownPosition } from './use-dropdown-position';

interface Props {
  category: Category;
  isActive?: boolean;
  isNavigationHovered?: boolean;
}

export const CategoryDropdown = ({
  category,
  isActive,
  isNavigationHovered
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { getDropdownPosition } = useDropdownPosition(dropdownRef);

  const debuncedClose = useCallback(
    debounce(() => setIsOpen(false), 150),
    []
  );

  const onMouseEnter = () => {
    if (category.subcategories) {
      setIsOpen(true);
    }
  };

  const onMouseLeave = () => {
    debuncedClose();
  };

  const toggleDropdown = () => {
    if (category.subcategories?.docs?.length) {
      setIsOpen(!isOpen);
    }
  };
  useEffect(() => {
    return () => {
      debuncedClose.cancel();
    };
  }, [debuncedClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (category.subcategories?.docs?.length) {
        setIsOpen(!isOpen);
        e.preventDefault();
      }
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
      e.preventDefault();
    }
  };

  const dropdownPosition = isOpen ? getDropdownPosition() : { top: 0, left: 0 };
  // outer div is the ref we are passing to the getDropdownPosition method in the custom hook.
  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <div className="relative">
        <Button
          variant="elevated"
          aria-expanded={isOpen}
          aria-haspopup="true"
          className={cn(
            'h-11 px-4 bg-transparent border-transparent rounded-full hover:bg-white hover:border-primary text-black',
            isActive && !isNavigationHovered && 'bg-white border-primary'
          )}
          onClick={toggleDropdown}
        >
          {category.name}
        </Button>
        {category.subcategories && category.subcategories.length > 0 && (
          <div
            className={cn(
              'opacity-0 absolute -bottom-3 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-b-black left-1/2 -translate-x-1/2',
              isOpen && 'opacity-100'
            )}
          />
        )}
      </div>
      <SubcategoryMenu
        category={category}
        isOpen={isOpen}
        position={dropdownPosition}
      />
    </div>
  );
};
