import {
  useQueryStates,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral
} from 'nuqs';

const sortValues = ['curated', 'trending', 'hot_and_new'] as const;
// withDefault('') clears the query strings.
const params = {
  sort: parseAsStringLiteral(sortValues).withDefault('curated'),
  minPrice: parseAsString
    .withOptions({
      clearOnDefault: true
    })
    .withDefault(''),
  maxPrice: parseAsString
    .withOptions({
      clearOnDefault: true
    })
    .withDefault(''),
  tags: parseAsArrayOf(parseAsString)
    .withOptions({
      clearOnDefault: true
    })
    .withDefault([]),
  search: parseAsString
    .withOptions({
      clearOnDefault: true
    })
    .withDefault('')
};

export const useProductFilters = () => {
  return useQueryStates(params);
};
