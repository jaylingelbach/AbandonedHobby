import { Product } from '@/payload-types';

/** Individual image entry from Product.images array */
export type ProductImage = NonNullable<Product['images']>[number];
