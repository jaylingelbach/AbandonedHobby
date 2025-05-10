import { Category } from '@/payload-types';
import { baseProcedure, createTRPCRouter } from '@/trpc/init';

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async ({ ctx }) => {
    const data = await ctx.db.find({
      collection: 'categories',
      depth: 1, // if having problems querying increase. https://payloadcms.com/docs/queries/depth subcategories.[0] will ve of type Category. If depth is set to 0 will be strings and break everything.
      pagination: false, // can change if there become too many
      where: {
        parent: {
          exists: false
        }
      },
      sort: 'name'
    });

    const formattedData = data.docs.map((doc) => ({
      ...doc,
      subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
        // Because of 'depth 1' we are confident doc will be of type Category
        ...(doc as Category)
      }))
    }));

    return formattedData;
  })
});
