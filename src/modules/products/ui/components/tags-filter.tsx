import { useInfiniteQuery } from '@tanstack/react-query';
import { LoaderIcon } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_LIMIT } from '@/constants';
import { useTRPC } from '@/trpc/client';

interface TagsFilterProps {
  value?: string[] | null;
  onChange: (value: string[]) => void;
}

export const TagsFilter = ({ value, onChange }: TagsFilterProps) => {
  const trpc = useTRPC();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error
  } = useInfiniteQuery(
    trpc.tags.getMany.infiniteQueryOptions(
      {
        limit: DEFAULT_LIMIT
      },
      {
        getNextPageParam: (lastPage) => {
          return lastPage.docs.length > 0 ? lastPage.nextPage : undefined;
        }
      }
    )
  );

  if (error) {
    return (
      <div className="text-red-500 p-2">
        Failed to load tags. Please try again.
      </div>
    );
  }
  const onClick = (tag: string) => {
    // tag already in list? Remove, otherwise add it to the list .
    if (value?.includes(tag)) {
      onChange(value?.filter((t) => t !== tag) || []);
    } else {
      onChange([...(value || []), tag]);
    }
  };

  return (
    <div className="flex flex-col gap-y-2">
      {isLoading ? (
        <div className="flex items-center justify-center p-4">
          <LoaderIcon className="size-4 animate-spin " />
        </div>
      ) : (
        data?.pages.map((page) =>
          page.docs.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between cursor-pointer"
              onClick={() => onClick(tag.name)}
            >
              <p className="font-medium">{tag.name}</p>
              <Checkbox
                checked={value?.includes(tag.name)}
                onCheckedChange={() => onClick(tag.name)}
              />
            </div>
          ))
        )
      )}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center p-2">
          <LoaderIcon className="size-3 animate-spin mr-2" />
          <span className="text-sm">Loading more...</span>
        </div>
      )}
      {hasNextPage && (
        <button
          disabled={isFetchingNextPage}
          className="underline font-medium justify-start text-start disabled:opacity-50 cursor-pointer"
          onClick={() => fetchNextPage()}
        >
          Load more ...
        </button>
      )}
    </div>
  );
};
