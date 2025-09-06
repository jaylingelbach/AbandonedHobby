import { Media, Product, Tenant } from '@/payload-types';

export type ProductWithRatings = Product & {
  reviewCount: number;
  reviewRating: number;
};
export type LibraryListItem = Omit<Product, 'image' | 'tenant'> & {
  orderId: string;
  reviewCount: number;
  reviewRating: number;
  image: Media | null;
  tenant: Tenant & { image: Media | null };
};

export type OrderMinimal = {
  id: string;
  user?: string;
  buyer?: string;
  product?: string | Product | null;
  items?: Array<{ product?: string | Product | null }> | null;
};

export type ProductCardDTO = {
  id: string;
  name: string;
  image: Media | null;
  tenant: (Tenant & { image: Media | null }) | null;
  reviewCount: number;
  reviewRating: number;
  orderId: string;
};
