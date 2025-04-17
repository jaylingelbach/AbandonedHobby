import configPromise from '@payload-config';
import { getPayload } from 'payload';

import { Navbar } from './navbar';
import { Footer } from './footer';
import { SearchFilters } from './search-filters';
import { Category } from '@/payload-types';

interface Props {
  children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
  try {
    const payload = await getPayload({
      config: configPromise
    });

    const data = await payload.find({
      collection: 'categories',
      depth: 1, // if having problems querying increase. https://payloadcms.com/docs/queries/depth subcategories.[0] will ve of type Category. If depth is set to 0 will be strings and break everything.
      pagination: false, // can change if there become too many
      where: {
        parent: {
          exists: false
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch categories: ', error);
  }

  // simplifying data structure.
  const formattedData = data.docs.map((doc) => ({
    ...doc,
    subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
      // Because of 'depth 1' we are confident doc will be of type Category
      ...(doc as Category)
    }))
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <SearchFilters data={formattedData} />
      <div className="flex-1 bg-[#F4F4F0]">{children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
