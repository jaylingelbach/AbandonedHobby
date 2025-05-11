import z from 'zod';
import type { Sort, Where } from 'payload';
import { Category } from '@/payload-types';

import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { sortValues } from '../search-params';

export const productsRouter = createTRPCRouter({
  getMany: baseProcedure
    .input(
      z.object({
        category: z.string().nullable().optional(),
        minPrice: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        sort: z.enum(sortValues).nullable().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Where = {}; // default is empty obj

      let sort: Sort = '-createdAt';

      if (input.sort === 'curated') {
        return (sort = '-createdAt');
      }

      if (input.sort === 'hot_and_new') {
        return (sort = '-createdAt');
      }

      if (input.sort === 'trending') {
        return (sort = '+createdAt');
      }

      if (input.minPrice) {
        where.price = {
          greater_than_equal: input.minPrice
        };
      }

      if (input.maxPrice) {
        where.price = {
          less_than_equal: input.maxPrice
        };
      }

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
          where['category.slug'] = {
            in: [parentCategory.slug, ...subcategorieSlugs]
          };
        }
      }

      if (input.tags && input.tags.length > 0) {
        where['tags.name'] = {
          in: input.tags
        };
      }

      const data = await ctx.db.find({
        collection: 'products',
        depth: 1, // will populate category and image
        where,
        sort
      });
      // await new Promise((resolve) => setTimeout(resolve, 1000));
      return data;
    })
});
