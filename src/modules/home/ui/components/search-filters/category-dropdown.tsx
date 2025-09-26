'use client';

import debounce from 'lodash/debounce';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CategoriesGetManyOutputSingle } from '@/modules/categories/types';

import { SubcategoryMenu } from './subcategory-menu';


interface Props {
  category: CategoriesGetManyOutputSingle;
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

  // Create the debounced “close” function once.
  const debouncedClose = useMemo(
    () =>
      debounce(() => {
        setIsOpen(false);
      }, 150),
    []
  );

  const onMouseEnter = () => {
    if (category.subcategories) {
      setIsOpen(true);
    }
  };

  const onMouseLeave = () => {
    debouncedClose();
  };

  const toggleDropdown = () => {
    if (category.subcategories?.length) {
      setIsOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    // On unmount, cancel the pending debounced call
    return () => {
      debouncedClose.cancel();
    };
  }, [debouncedClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (category.subcategories?.length) {
        setIsOpen((prev) => !prev);
        e.preventDefault();
      }
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
      e.preventDefault();
    }
  };

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
            isActive && !isNavigationHovered && 'bg-white border-primary',
            isOpen &&
              'bg-white border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-x-[4px] -translate-y-[4px]'
          )}
          onClick={toggleDropdown}
        >
          <Link href={`/${category.slug === 'all' ? '' : category.slug}`}>
            {category.name}
          </Link>
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
      <SubcategoryMenu category={category} isOpen={isOpen} />
    </div>
  );
};
