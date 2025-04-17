import type { CollectionConfig } from 'payload';

export const Categories: CollectionConfig = {
  slug: 'categories',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    }
  ]
};

// after adding a new collection you must go to payload.config.ts & add it to collections & restart dev server
// OR run bun run generate:types
