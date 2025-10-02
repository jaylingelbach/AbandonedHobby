import { authRouter } from '@/modules/auth/server/procedures';
import { categoriesRouter } from '@/modules/categories/server/procedures';
import { checkoutRouter } from '@/modules/checkout/server/procedures';
import { conversationsRouter } from '@/modules/conversations/server/procedures';
import { libraryRouter } from '@/modules/library/server/procedures';
import { messagesRouter } from '@/modules/messages/server/procedures';
import { notificationsRouter } from '@/modules/notifications/server/procedures';
import { ordersRouter } from '@/modules/orders/server/procedures';
import { productsRouter } from '@/modules/products/server/procedures';
import { reviewsRouter } from '@/modules/reviews/server/procedures';
import { tagsRouter } from '@/modules/tags/server/procedures';
import { tenantsRouter } from '@/modules/tenants/server/procedures';
import { usersRouter } from '@/modules/users/server/procedures';

import { createTRPCRouter } from '../init';
import { refundsRouter } from '@/modules/refunds/procedures';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  categories: categoriesRouter,
  checkout: checkoutRouter,
  conversations: conversationsRouter,
  library: libraryRouter,
  messages: messagesRouter,
  notifications: notificationsRouter,
  orders: ordersRouter,
  products: productsRouter,
  refunds: refundsRouter,
  reviews: reviewsRouter,
  tags: tagsRouter,
  tenants: tenantsRouter,
  users: usersRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;
