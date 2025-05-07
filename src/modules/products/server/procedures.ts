import z from 'zod';
import type { Where } from 'payload';
import { Category } from '@/payload-types';

import { baseProcedure, createTRPCRouter } from '@/trpc/init';

export const productsRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        category: z.string().nullable().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Where = {}; // default is empty obj
      if (input.category) {
        const categoriesData = await ctx.db.find({
          collection: 'categories',
          limit: 1,
          depth: 1, // populate subcategories
          where: {
            slug: {
              equals: input.category
            }
          }
        });

        const formattedData = categoriesData.docs.map((doc) => ({
          ...doc,
          subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
            // Because of 'depth 1' we are confident doc will be of type Category
            ...(doc as Category),
            subcategories: undefined
          }))
        }));
        const subcategorieSlugs = [];
        const parentCategory = formattedData[0];

        if (parentCategory) {
          subcategorieSlugs.push(
            ...parentCategory.subcategories.map(
              (subcategory) => subcategory.slug
            )
          );
        }
        where['category.slug'] = {
          in: [parentCategory.slug, ...subcategorieSlugs]
        };
      }
      const data = await ctx.db.find({
        collection: 'products',
        depth: 1, // will populate category and image
        where
      });
      // await new Promise((resolve) => setTimeout(resolve, 1000));
      return data;
    })
});
