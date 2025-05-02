import { Category } from '@/payload-types';
import configPromise from '@payload-config';
import { getPayload } from 'payload';

import { CustomCategory } from './types';
import { Footer } from './footer';
import { Navbar } from './navbar';
import { SearchFilters } from './search-filters';

interface Props {
  children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
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
    },
    sort: 'name'
  });

  // simplifying data structure.
  const formattedData: CustomCategory[] = data.docs.map((doc) => ({
    ...doc,
    subcategories: (doc.subcategories?.docs ?? []).map((doc) => ({
      // Because of 'depth 1' we are confident doc will be of type Category
      ...(doc as Category),
      subcategories: undefined
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
