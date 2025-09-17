import { isSuperAdmin } from '@/lib/access';
import type { CollectionConfig } from 'payload';

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    delete: ({ req: { user } }) => isSuperAdmin(user)
  },
  admin: {
    hidden: ({ user }) => !isSuperAdmin(user)
  },
  upload: {
    mimeTypes: ['image/*'],
    // Optional thumbnails/sizes (Payload will generate, then the plugin stores them on S3)
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
        position: 'centre'
      },
      {
        name: 'medium',
        width: 1000,
        height: 1000,
        position: 'centre'
      }
    ],
    adminThumbnail: 'thumbnail'
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
      admin: {
        description:
          'Adds text for those who use screen readers or are visually impaired'
      }
    }
  ]
};
