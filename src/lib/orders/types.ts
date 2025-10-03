export type OrderWithItems = {
  id: string;
  name?: string | null; // e.g. "Guitar effects pedal (+2 more)"
  total: number; // cents
  currency?: string | null;
  items?: OrderItemLite[];
};

export type OrderItemLite = {
  id?: string;
  nameSnapshot?: string | null;
  // put your image path here:
  imageUrl?: string | null;
  product?: { image?: { url?: string | null } } | null; // if you store images on product
};
