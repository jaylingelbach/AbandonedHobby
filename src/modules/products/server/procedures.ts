import type { Sort, Where } from 'payload';
import { headers as getHeaders } from 'next/headers';
import z from 'zod';

import { baseProcedure, createTRPCRouter } from '@/trpc/init';
import { Media, Tenant } from '@/payload-types';
import { TRPCError } from '@trpc/server';

import { DEFAULT_LIMIT } from '@/constants';
import { sortValues } from '@/modules/products/search-params';

export const productsRouter = createTRPCRouter({
  getOne: baseProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const headers = await getHeaders();
      const session = await ctx.db.auth({ headers });

      const product = await ctx.db.findByID({
        collection: 'products',
        depth: 2, // Load product.image, product.cover, product.tenant & product.tenant.image
        id: input.id,
        select: {
          content: false
        }
      });

      if (product.isArchived) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product has been archived'
        });
      }

      let isPurchased = false;

      if (session.user) {
        const ordersData = await ctx.db.find({
          collection: 'orders',
          pagination: false,
          limit: 1,
          where: {
            and: [
              {
                product: {
                  equals: input.id
                }
              },
              {
                user: {
                  equals: session.user.id
                }
              }
            ]
          }
        });
        isPurchased = ordersData.totalDocs > 0;
      }
      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `ProductID with ID: ${input.id} not found`
        });
      }

      const reviews = await ctx.db.find({
        collection: 'reviews',
        pagination: false,
        where: {
          product: {
            equals: input.id
          }
        }
      });

      const reviewRating =
        reviews.docs.length > 0
          ? reviews.docs.reduce((acc, review) => acc + review.rating, 0) /
            reviews.totalDocs
          : 0;

      const ratingDistribution: Record<number, number> = {
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0
      };

      if (reviews.totalDocs > 0) {
        reviews.docs.forEach((review) => {
          const rating = review.rating;

          if (rating >= 1 && rating <= 5) {
            ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
          }
        });

        // Convert counts to percentages after all reviews are processed
        Object.keys(ratingDistribution).forEach((key) => {
          const rating = Number(key);
          const count = ratingDistribution[rating] || 0;
          ratingDistribution[rating] = Math.round(
            (count / reviews.totalDocs) * 100
          );
        });
      }
      return {
        ...product,
        isPurchased,
        image: (product.image as Media) || null,
        cover: (product.cover as Media) || null,
        tenant: product.tenant as Tenant & { image: Media | null },
        reviewRating,
        reviewCount: reviews.totalDocs,
        ratingDistribution
      };
    }),
  // getMany: baseProcedure
  //   .input(
  //     z.object({
  //       cursor: z.number().default(1),
  //       limit: z.number().default(DEFAULT_LIMIT),
  //       category: z.string().nullable().optional(),
  //       minPrice: z.string().nullable().optional(),
  //       maxPrice: z.string().nullable().optional(),
  //       tags: z.array(z.string()).nullable().optional(),
  //       sort: z.enum(sortValues).nullable().optional(),
  //       tenantSlug: z.string().nullable().optional(), // sort by tenant (shop)
  //       search: z.string().nullable().optional()
  //     })
  //   )
  //   .query(async ({ ctx, input }) => {
  //     const where: Where = {
  //       isArchived: {
  //         not_equals: true
  //       }
  //     };

  //     let sort: Sort = '-createdAt';

  //     if (input.sort === 'curated') {
  //       sort = '-createdAt';
  //     }

  //     if (input.sort === 'hot_and_new') {
  //       sort = '+createdAt';
  //     }

  //     if (input.sort === 'trending') {
  //       sort = '-createdAt';
  //     }

  //     if (input.minPrice) {
  //       where.price = {
  //         greater_than_equal: input.minPrice
  //       };
  //     }

  //     if (input.maxPrice) {
  //       where.price = {
  //         less_than_equal: input.maxPrice
  //       };
  //     }
  //     // Loads products for a specific shop (tenant).
  //     if (input.tenantSlug) {
  //       where['tenant.slug'] = {
  //         equals: input.tenantSlug
  //       };
  //     } else {
  //       // Filters products for the main marketplace. Filters out private products.
  //       where['isPrivate'] = {
  //         // Filters for marketplace
  //         not_equals: true
  //       };
  //     }

  //     if (input.search) {
  //       where['name'] = {
  //         like: input.search
  //       };
  //     }

  //     if (input.category) {
  //       const categoriesData = await ctx.db.find({
  //         collection: 'categories',
  //         limit: 1,
  //         depth: 1, // populate subcategories
  //         where: {
  //           slug: {
  //             equals: input.category
  //           }
  //         }
  //       });

  //       const formattedData = categoriesData.docs.map((doc) => ({
  //         ...doc,
  //         subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
  //           // Because of 'depth 1' we are confident doc will be of type Category
  //           ...(doc as Category),
  //           subcategories: undefined
  //         }))
  //       }));
  //       const subcategorieSlugs = [];
  //       const parentCategory = formattedData[0];

  //       if (parentCategory) {
  //         subcategorieSlugs.push(
  //           ...parentCategory.subcategories.map(
  //             (subcategory) => subcategory.slug
  //           )
  //         );
  //         where['category.slug'] = {
  //           in: [parentCategory.slug, ...subcategorieSlugs]
  //         };
  //       }
  //     }

  //     if (input.tags && input.tags.length > 0) {
  //       where['tags.name'] = {
  //         in: input.tags
  //       };
  //     }

  //     const data = await ctx.db.find({
  //       collection: 'products',
  //       depth: 2, // will populate category, image, and tenant & tenant.image (with depth set to 2)
  //       where,
  //       sort,
  //       page: input.cursor,
  //       limit: input.limit,
  //       select: {
  //         content: false
  //       }
  //     });

  //     const dataWithSummaizedReviews = await Promise.all(
  //       data.docs.map(async (doc) => {
  //         const reviewsData = await ctx.db.find({
  //           collection: 'reviews',
  //           pagination: false, // load all
  //           where: {
  //             product: {
  //               equals: doc.id
  //             }
  //           }
  //         });
  //         return {
  //           ...doc,
  //           reviewCount: reviewsData.totalDocs,
  //           reviewRating:
  //             reviewsData.docs.length === 0
  //               ? 0
  //               : reviewsData.docs.reduce(
  //                   (acc, review) => acc + review.rating,
  //                   0
  //                 ) / reviewsData.totalDocs
  //         };
  //       })
  //     );

  //     return {
  //       ...data,
  //       docs: dataWithSummaizedReviews.map((doc) => ({
  //         ...doc,
  //         image: doc.image as Media | null, // settings types so we can get imageURL in product list
  //         tenant: doc.tenant as Tenant & { image: Media | null } // no need for | null bc Tenant is required for all products
  //       }))
  //     };
  //   })
  getMany: baseProcedure
    .input(
      z.object({
        cursor: z.number().default(1),
        limit: z.number().default(DEFAULT_LIMIT),
        category: z.string().nullable().optional(),
        subcategory: z.string().nullable().optional(), // 👈 NEW
        minPrice: z.string().nullable().optional(),
        maxPrice: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        sort: z.enum(sortValues).nullable().optional(),
        tenantSlug: z.string().nullable().optional(), // sort by tenant (shop)
        search: z.string().nullable().optional()
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Where = {
        isArchived: {
          not_equals: true
        }
      };

      let sort: Sort = '-createdAt';

      if (input.sort === 'curated') {
        sort = '-createdAt';
      }

      if (input.sort === 'hot_and_new') {
        sort = '+createdAt';
      }

      if (input.sort === 'trending') {
        sort = '-createdAt';
      }

      if (input.minPrice) {
        where.price = {
          greater_than_equal: input.minPrice
        };
      }

      if (input.maxPrice) {
        // NOTE: this overwrites min if both are set, matching your current behavior
        where.price = {
          less_than_equal: input.maxPrice
        };
      }

      // Loads products for a specific shop (tenant).
      if (input.tenantSlug) {
        where['tenant.slug'] = {
          equals: input.tenantSlug
        };
      } else {
        // Filters products for the main marketplace. Filters out private products.
        where['isPrivate'] = {
          not_equals: true
        };
      }

      if (input.search) {
        where['name'] = {
          like: input.search
        };
      }

      // ──────────────────────────────────────────────────────────
      // ✅ Subcategory-first filter (by subcategory relationship ID)
      // ──────────────────────────────────────────────────────────
      if (input.subcategory) {
        const subRes = await ctx.db.find({
          collection: 'categories',
          limit: 1,
          depth: 0,
          where: { slug: { equals: input.subcategory } }
        });
        const sub = subRes.docs[0];

        if (!sub) {
          // Force no results if subcategory slug doesn't exist
          where.id = { equals: '__no_results__' };
        } else {
          // Optional sanity: if category is also provided, ensure parent matches
          if (input.category) {
            const parentId =
              typeof sub.parent === 'object' ? sub.parent?.id : sub.parent;

            const parentRes = await ctx.db.find({
              collection: 'categories',
              limit: 1,
              depth: 0,
              where: { slug: { equals: input.category } }
            });
            const parentCat = parentRes.docs[0];

            if (!parentCat || String(parentId) !== String(parentCat.id)) {
              // Mismatch → force no results
              where.id = { equals: '__no_results__' };
            } else {
              where.subcategory = { equals: sub.id };
              // (Optional) also enforce category match for belt-and-suspenders:
              // where.category = { equals: parentCat.id };
            }
          } else {
            where.subcategory = { equals: sub.id };
          }
        }
      }
      // ──────────────────────────────────────────────────────────
      // ✅ Category-only: include products in the category OR any of its children
      // ──────────────────────────────────────────────────────────
      else if (input.category) {
        const catRes = await ctx.db.find({
          collection: 'categories',
          limit: 1,
          depth: 0,
          where: { slug: { equals: input.category } }
        });
        const cat = catRes.docs[0];

        if (cat) {
          const childrenRes = await ctx.db.find({
            collection: 'categories',
            pagination: false,
            depth: 0,
            where: { parent: { equals: cat.id } }
          });
          const childIds = childrenRes.docs.map((d) => d.id);

          // IMPORTANT: filter by relationship fields (category/subcategory),
          // not by 'category.slug' on products.
          where.or = [
            { category: { equals: cat.id } },
            ...(childIds.length ? [{ subcategory: { in: childIds } }] : [])
          ];
        } else {
          // Unknown category slug → force no results
          where.id = { equals: '__no_results__' };
        }
      }

      const data = await ctx.db.find({
        collection: 'products',
        depth: 2, // populate category, image, tenant & tenant.image
        where,
        sort,
        page: input.cursor,
        limit: input.limit,
        select: {
          content: false
        }
      });

      const dataWithSummaizedReviews = await Promise.all(
        data.docs.map(async (doc) => {
          const reviewsData = await ctx.db.find({
            collection: 'reviews',
            pagination: false, // load all
            where: {
              product: {
                equals: doc.id
              }
            }
          });
          return {
            ...doc,
            reviewCount: reviewsData.totalDocs,
            reviewRating:
              reviewsData.docs.length === 0
                ? 0
                : reviewsData.docs.reduce(
                    (acc, review) => acc + review.rating,
                    0
                  ) / reviewsData.totalDocs
          };
        })
      );

      return {
        ...data,
        docs: dataWithSummaizedReviews.map((doc) => ({
          ...doc,
          image: doc.image as Media | null,
          tenant: doc.tenant as Tenant & { image: Media | null }
        }))
      };
    })
});
