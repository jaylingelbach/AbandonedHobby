import { isSuperAdmin } from '@/lib/access';

import type { CollectionConfig } from 'payload';


export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: () => true,
    create: ({ req: { user } }) => isSuperAdmin(user),
    update: ({ req: { user } }) => isSuperAdmin(user),
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => !isSuperAdmin(user)
  },
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
