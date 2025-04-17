import type { CollectionConfig } from 'payload';

export const Categories: CollectionConfig = {
  slug: 'categories',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true
    },
    {
      name: 'color',
      type: 'text'
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: false
    },
    {
      name: 'subcategories',
      type: 'join',
      collection: 'categories',
      on: 'parent',
      hasMany: true
    }
  ]
};

// after adding a new collection you must go to payload.config.ts & add it to collections & restart dev server
// OR run bun run generate:types
