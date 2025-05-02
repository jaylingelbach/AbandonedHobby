import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';

import { CustomCategory } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CustomCategory[]; // TODO: remove
}

export const CategoriesSidebar = ({ open, onOpenChange, data }: Props) => {
  const [parentCategories, setParentCategories] = useState<
    CustomCategory[] | null
  >(null);

  const [selectedCategory, setSelectedCategory] =
    useState<CustomCategory | null>(null);

  // parent categories? show.
  const currentCategories = parentCategories ?? data ?? [];

  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    setSelectedCategory(null);
    setParentCategories(null);
    onOpenChange(open);
  };

  const handleCategoryClick = (category: CustomCategory) => {
    if (category.subcategories && category.subcategories.length > 0) {
      setParentCategories(category.subcategories as CustomCategory[]);
      setSelectedCategory(category);
    } else {
      if (parentCategories && selectedCategory) {
        router.push(`/${selectedCategory.slug}/${category.slug}`);
      } else {
        if (category.slug === 'all') {
          router.push('/');
        } else {
          router.push(`/${category.slug}`);
        }
      }
      //
      handleOpenChange(false);
    }
  };

  const handleBackClick = () => {
    if (parentCategories) {
      setParentCategories(null);
      setSelectedCategory(null);
    }
  };
  const backgroundColor = selectedCategory?.color || 'white';
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="left"
        className="p-0 transition-none"
        style={{ backgroundColor }}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Categories</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex flex-col overflow-y-auto h-full pb-2">
          {parentCategories && (
            <button
              onClick={handleBackClick}
              className="w-full text-left p-4 hover:bg-black hover:text-white flex items-center text-base font-medium cursor-pointer"
            >
              <ChevronLeftIcon className="size-4 mr-2" />
              Back
            </button>
          )}
          {currentCategories.map((category) => (
            <button
              className="w-full text-left p-4 hover:bg-black hover:text-white flex justify-between text-base font-medium cursor-pointer"
              key={category.slug}
              onClick={() => handleCategoryClick(category)}
            >
              {category.name}
              {category.subcategories && category.subcategories.length > 0 && (
                <ChevronRightIcon className="size-4" />
              )}
            </button>
          ))}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
