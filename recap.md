# Changes I may want to make:

- Checkout-view.tsx on success where do I want to route? Currently routing to library.

# Categories finalization

### New Features

- Introduced a responsive and interactive category navigation sidebar for improved browsing on all devices.
- Added a new script to seed the database with a comprehensive set of categories and subcategories.
- Enhanced category selection with dynamic sidebar and dropdown navigation, including deep linking by category slug.

### Bug Fixes

- Corrected the database migration script command in the project scripts.
  Refactor
- Updated category-related components to use a unified, more descriptive category type for improved data handling.
- Improved responsive layout and category display logic for better usability across screen sizes.

### Style

-Standardized code formatting and styling in dropdown menu components.

### Chores

- Removed the old demo server and its static activity feed endpoint.
- Updated package configuration to use ES modules.

### Documentation

- Added a recap markdown note summarizing the finalization of the categories feature.

#

# tRPC integration 5/2/25

### New Features

- Introduced tRPC and React Query integration for efficient data fetching and state management.
  Added new API endpoints for category retrieval using tRPC.
- Implemented client and server providers for tRPC and React Query.
- Enhanced category sidebar and filter components to fetch data dynamically.

### Bug Fixes

- Improved type safety for category-related components and data structures.

### Refactor

- Refactored category and search filter components to use internal data fetching instead of prop drilling.
- Simplified and updated component props and removed obsolete types.

### Chores

- Updated dependencies and added new packages for tRPC, React Query, and related utilities.
- Added and updated workspace configuration for TypeScript support.

###

# Authentication 5/5/25

### New Features

- Introduced user authentication with sign-in and sign-up pages, including form validation and error handling.
- Added support for username during registration, with live validation and preview.
- Implemented session management, logout, and authentication status retrieval.
  - Added global toast notifications for feedback on authentication actions.

### Enhancements

- The home page now displays user session information when available.

### Data Model Updates

- User profiles now require a unique username field.

### Other

- Improved documentation and comments for clarity.

### File(s) Change Summary

- src/app/(app)/(auth)/sign-up/page.tsx
  - Added new Next.js page components for sign-in and sign-up, each rendering their respective view components.
- src/app/(app)/(home)/page.tsx
  - Converted Home component to client-side, added session query with TRPC, and now renders user JSON data.
- src/app/(app)/layout.tsx
  - Added global Toaster component inside TRPCReactProvider for toast notifications.
- src/collections/Users.ts
  - Added required, unique username field to Users collection configuration.
- src/modules/auth/constants.ts
  - Introduced and exported AUTH_COOKIE constant for authentication cookie management.
- src/modules/auth/schemas.ts
  - Added and exported loginSchema and registerSchema using Zod for authentication form validation.
- src/modules/auth/server/procedures.ts
  - Added authRouter TRPC router with session, logout, register, and login procedures for authentication.
- src/modules/auth/ui/views/sign-in-view.tsx
  - Added SignInView React component with form validation, TRPC login mutation, and UI feedback.
- src/modules/auth/ui/views/sign-up-view.tsx
  - Added SignUpView React component with form validation, TRPC register mutation, username preview, and UI feedback.
- src/payload-types.ts
  - Extended User and UsersSelect interfaces to include the username field.
- src/trpc/init.ts
  - Updated a comment in baseProcedure middleware for clarity; no code changes.
- src/trpc/routers/\_app.ts
  - Imported and added authRouter to the main TRPC appRouter under the auth key.

###

# Auth states 5/6/25

### New Features

- Sign-in and sign-up pages now automatically redirect authenticated users to the home page.
- Navbar dynamically displays a "Dashboard" button for authenticated users, or "Login" and "Start Selling" for others.
- "Library" button appears in search filters for authenticated users.

### Improvements

- Session state is now checked server-side for authentication pages, enhancing security and user experience.
- Session data is refreshed after successful sign-in or sign-up, ensuring up-to-date user information.
  Bug Fixes

- Removed unused props from the search input component.

### Chores

- Internal authentication cookie handling was centralized and streamlined.
- Unused constants and the logout mutation were removed.

### Changes to files:

- src/app/(app)/(auth)/sign-in/page.tsx,

  - Converted Page components to async arrow functions; added server-side session checks and conditional redirects for authenticated users.

- src/app/(app)/(home)/navbar.tsx

  - Integrated session state via tRPC and React Query; updated conditional rendering of navigation buttons based on authentication status.

- src/modules/auth/server/procedures.ts
  - Removed logout mutation; replaced direct cookie manipulation with new generateAuthCookie utility in authentication mutations.
    -src/modules/auth/ui/views/sign-in-view.tsx
  - Added cache invalidation for session queries on successful login/registration using React Query's useQueryClient.
- src/modules/auth/utiils.ts
  - Added new generateAuthCookie utility to encapsulate authentication cookie creation logic.
- src/trpc/server.ts
  - Added new exported caller for direct server-side tRPC procedure invocation.

# Category Pages 5/6/25

### New Features

- Added breadcrumb navigation to display the current category and subcategory.
- Introduced dynamic category and subcategory pages for improved navigation.
- Updated category selection to reflect the current route.

### Improvements

- Enhanced search filters with responsive design and dynamic background colors based on category.

### Bug Fixes

- Prevented duplicate categories and subcategories during database seeding.

### Chores

- Updated import paths for better code organization.

### Changes to files:

- src/app/(app)/(home)/[category]/[subcategory]/page.tsx
- src/app/(app)/(home)/[category]/page.tsx
  - Added new asynchronous React server components for category and subcategory pages, rendering category and subcategory names from awaited route parameters.
- src/app/(app)/(home)/layout.tsx
  - Updated import paths for Footer, Navbar, SearchFilters, and SearchFiltersLoading to use absolute imports from the home UI components directory
- src/app/(app)/(home)/search-filters/index.tsx
  - Deleted file containing the previous implementations of SearchFilters and SearchFiltersLoading components.
- src/modules/home/ui/components/search-filters/index.tsx
  - Added new SearchFilters and SearchFiltersLoading components, now using React Query, TRPC, and Next.js route params for dynamic rendering and category/subcategory awareness.
- src/modules/home/ui/components/search-filters/breadcrumb-navigation.tsx
  - Introduced BreadcrumbNavigation component to display navigational breadcrumbs based on active category and subcategory.
- src/modules/home/ui/components/search-filters/categories.tsx
  - Enhanced Categories component to dynamically set the active category from URL params and added a variant prop to the "View All" button.
- src/modules/home/constants.ts
  - Added DEFAULT_BG_COLOR constant with value 'F5F5F5'.
- src/lib/seed.ts
  - Improved seeding logic to prevent duplicate categories and subcategories, added "All" and "Drawing & Painting" categories, and updated success message.

# Products 5/6/25

### Summary

This update introduces a new "Products" collection to the CMS schema, complete with type definitions and admin configuration. It implements a TRPC router for querying products by category and subcategory, and adds React components for data-driven product listing with server-side prefetching, client-side hydration, and suspense-based loading states. Minor improvements and comments are also included in related UI components.

### New Features

- Introduced a new Products collection in the CMS, enabling management of products with fields such as name, description, price, category, image, and refund policy.

- Added product listing pages that display products by category and subcategory, with support for server-side data prefetching and client-side hydration.

- Implemented a loading skeleton for product lists to enhance user experience during data fetching.
  Improvements

- The admin interface now displays category entries using their names for easier identification.
  Technical Enhancements

- Product data is now fetched dynamically and rendered using suspense-enabled components for smoother and more responsive UI updates.

### Changes:

- src/collections/Products.ts, src/payload-types.ts, src/payload.config.ts
  - Added a new "Products" collection to the CMS, defined its schema, types, and registered it in the config.
- src/collections/Categories.ts
  - Added admin configuration to use the "name" field as the display title for categories.
- src/modules/products/server/procedures.ts, src/trpc/routers/\_app.ts
  - Introduced a TRPC router for products, with a getMany procedure for querying products by category and subcategories; registered the router in the main app router.
- src/modules/products/types.ts
  - Added TypeScript types for the output of the products TRPC router.
- src/modules/products/ui/components/product-list.tsx
  - Added ProductList and ProductListSkeleton React components for displaying products and loading states.
- src/app/(app)/(home)/[category]/[subcategory]/page.tsx, src/app/(app)/(home)/[category]/page.tsx
  - Refactored category and subcategory pages to prefetch product data, hydrate React Query state, and render product lists with suspense and skeleton loading.
- src/modules/home/ui/components/search-filters/categories.tsx
  - Added a TODO comment to clarify future logic for the "all" category button; no functional changes.

# Filters 1 5/10/25

### New Features

- Added price filtering to product listings, allowing users to filter products by minimum and maximum price.
- Introduced a sidebar with collapsible product filter sections for improved browsing.

### Improvements

- Updated the product list to display products in a styled grid of cards for better readability.
- Enhanced the home page layout with a responsive grid, displaying filters and products side by side.
- Improved navigation bar behavior and styling, including corrected login link and button styles.
- Updated app metadata with a new title and description.

### Bug Fixes

- Fixed minor style and formatting issues in various components.

### Chores

- Updated dependencies and removed unused platform-specific packages.
- Improved TypeScript configuration for stricter type checking.

### File changes:

- src/modules/products/ui/components/product-filters.tsx, src/modules/products/ui/components/price-filter.tsx, src/modules/products/hooks/use-product-filters.ts
  - Added new product filter UI components (ProductFilters, ProductFilter, PriceFilter) and a custom hook (useProductFilters) to manage price filter state via URL query parameters.
- src/modules/products/server/procedures.ts
  - Extended the getMany procedure input schema to support optional minPrice and maxPrice filters. Updated query logic to apply price filtering. Refactored category filtering logic.
- src/app/(app)/(home)/[category]/page.tsx
  - Integrated the new ProductFilters component into the category page, updating the layout to a responsive grid with filters and product list side-by-side.
- src/modules/products/ui/components/product-list.tsx
  - Changed the product list from a raw JSON display to a styled grid of product cards.
- package.json
  - Added nuqs as a dependency; removed two platform-specific devDependencies.
- src/app/(app)/layout.tsx
  - Updated app metadata (title, description) and nested the root provider in a new NuqsAdapter for query state management.
- src/app/(app)/(home)/[category]/[subcategory]/page.tsx
  - Fixed import path for product list components.
- src/modules/categories/server/procedures.ts
  - Stopped forcibly setting subcategories to undefined in subcategory objects, preserving any existing subcategory data.
- src/modules/home/ui/components/navbar.tsx
  - Prevented rendering while session is loading, fixed button class typos, and updated the login link destination.
- src/modules/auth/ui/views/sign-up-view.tsx
  - Removed the prefetch attribute from the sign-in link.
- src/modules/home/ui/components/search-filters/categoriesSidebar.tsx
  - Code formatting and whitespace/style fixes; no logic changes.
- tsconfig.json
  - Enabled noUncheckedIndexedAccess for stricter type checking; reformatted arrays for compactness.

# Sort filters 5/11/25

### New Features

- Added support for filtering products by tags and sorting by curated, trending, or hot & new.
- Introduced a new Tags collection and tag management for products.
- Added a UI component for tag-based filtering with infinite scroll.
- Added a product sorting UI component.
- Added a "Curated for you" header and enhanced product filters with a clear button.

### Bug Fixes

- Fixed price filter input to correctly handle numeric values.

### Chores

- Improved server URL resolution for deployment environments.

### Changes to files:

- src/app/(app)/(home)/[category]/page.tsx
  - Enhanced Page component to accept searchParams, load filters asynchronously, and add a header with sorting UI.
- src/collections/Products.ts, src/collections/Tags.ts
  - Added a new tags relationship field to products and introduced the Tags collection schema.
- src/constants.ts
  - Added DEFAULT_LIMIT constant.
- src/modules/products/hooks/use-product-filters.ts

  - Refactored filter hook to centralize parameter definitions and add a sort parameter.

- src/modules/products/search-params.ts
  - New module for defining and loading product search parameters, including sort, minPrice, maxPrice, and tags.
- src/modules/products/server/procedures.ts
  - Updated getMany procedure to support tag filtering and sorting logic.
- src/modules/products/ui/components/price-filter.tsx

  - Fixed regex in max price handler for correct numeric input extraction.

- src/modules/products/ui/components/product-filters.tsx
  - Added tags filter section, conditional "Clear" button, and reset logic for filters.
- src/modules/products/ui/components/product-list.tsx
  - Incorporated dynamic filters from useProductFilters into product query.
- src/modules/products/ui/components/product-sort.tsx
  - New component for product sorting UI.
- src/modules/products/ui/components/tags-filter.tsx
  - New component for displaying and selecting tags with infinite scrolling.
- src/modules/tags/server/procedures.ts
  - New tagsRouter with paginated tag fetching.
- src/payload-types.ts
  - Added Tag interface and integrated tags into products and config types.
- src/payload.config.ts
  - Registered the new Tags collection in Payload CMS config.
- src/trpc/client.tsx
  - Changed server-side base URL resolution logic for TRPC client.
- src/trpc/routers/\_app.ts
  - Added tagsRouter to the main TRPC app router.

# Product List - UI 5/12/25

### New Features

- Added comprehensive product filtering by tags and sorting options (curated, trending, hot & new).
- Introduced infinite scroll and pagination for product listings.
- Added new UI components: tags filter with infinite scroll, product sorting, and enhanced product filters with clear button.
- Introduced product cards and skeleton loaders for improved loading experience.
- Added paginated tag fetching and filtering support.

### Enhancements

- Improved category and subcategory pages to support dynamic filters, sorting, and asynchronous loading.
- Updated default product listing limit for better browsing.

### Bug Fixes

- Corrected numeric input handling in the max price filter.

### File Changes:

- src/collections/Tags.ts, src/collections/Products.ts, src/payload-types.ts, src/payload.config.ts
  - Added new Tags collection schema, integrated tag relationships into Products schema, updated types, and registered tags in Payload CMS config.
- src/constants.ts
  - Changed DEFAULT_LIMIT from 5 to 8.
- src/modules/products/search-params.ts
  - Added new module for product search parameters (sort, minPrice, maxPrice, tags).
- src/modules/products/server/procedures.ts
  - Enhanced getMany procedure to support tag filtering, sorting, and pagination with cursor and limit parameters. Ensured type safety for product images.
- src/modules/tags/server/procedures.ts, src/trpc/routers/\_app.ts
  - Added new TRPC tagsRouter for paginated tag fetching and integrated it into the main router.
- src/trpc/client.tsx
  - Improved TRPC client base URL resolution for deployment environments.
- src/modules/products/hooks/use-product-filters.ts

  - Refactored hook to centralize parameters, include sorting, and support tag filtering.

- src/modules/products/ui/components/product-card.tsx - Added new ProductCard and ProductCardSkeleton components for product display and loading states.
- src/modules/products/ui/components/product-list.tsx
  - Refactored to use infinite query for pagination, render product cards, and update skeletons to match new limit.
- src/modules/products/ui/components/product-filters.tsx, src/modules/products/ui/components/tags-filter.tsx, src/modules/products/ui/components/product-sort.tsx
  - Updated/added components for tag filtering, sorting, and filter clearing in the UI.
- src/modules/products/ui/components/views/product-list-view.tsx
  - Added new ProductListView component to consolidate product list, filters, and sorting into a single view.
- src/app/(app)/(home)/[category]/page.tsx, src/app/(app)/(home)/[category]/[subcategory]/page.tsx
  - Simplified page components by delegating logic and UI to ProductListView, updated to accept and handle search parameters asynchronously.

# Multi tenancy

### New Features

- Introduced multi-tenant support, enabling management of multiple stores or tenants.
- Added a new Tenants admin interface with support for tenant details and Stripe integration.
- Enhanced user roles and permissions, including "super-admin" and tenant associations.

### Improvements

- Home page now uses server-side data fetching for faster product search and listing.
- Advanced category filtering with new dropdowns, sidebar, and dynamic UI components.
- Improved environment variable handling for setup and seeding.

### Bug Fixes

- Added defensive checks during data seeding to prevent runtime errors.

### Style

- Updated background color styling in loading components to use CSS classes.
- Improved code comments for better clarity.

### Chores

- Updated and added dependencies and scripts to support multi-tenancy and environment management.

### File Changes:

- package.json, src/app/(payload)/admin/importMap.js
  - Added multi-tenant plugin and dotenv dependencies/scripts. Extended import map for tenant components.
- src/collections/Tenants.ts, src/collections/Users.ts
  - Added new Tenants collection; enhanced Users with roles and tenant association fields.
- src/payload.config.ts
  - Integrated multi-tenant plugin, Tenants collection, and custom access control for super-admins.
- src/payload-types.ts
  - Introduced Tenant type; updated User, Product, and selection interfaces for tenant support.
- src/lib/seed.ts, src/modules/auth/server/procedures.ts
  - Seed and registration now create tenants and associate users with them.
- src/app/(app)/(home)/footer.tsx, navbar.tsx, navbar-sidebar.tsx
  - Added new Footer and responsive Navbar components with sidebar support.
- src/app/(app)/(home)/page.tsx
  - Converted home page to a server component with server-side data prefetching and hydration.
- src/app/(app)/(home)/search-filters/\*
  - Introduced a suite of search filter components: Categories, Sidebar, Dropdown, Subcategory menu, utility hook, and SearchInput.
- src/app/(app)/(home)/search-filters/index.tsx
  - Added main SearchFilters and loading state components.
- src/modules/home/ui/components/search-filters/category-dropdown.tsx
  - Reordered imports for clarity; no functional change.

# Tenant Pages 5/15/25

### New Features

- Introduced tenant-specific pages with dedicated layouts, navigation bars, and footers.
- Added the ability to filter and display products by tenant.
- Enabled interactive navigation to tenant pages from product cards.

# Enhancements

- Improved product list and card components to display tenant information and support dynamic grid layouts.
- Implemented client-side hydration and state management for tenant and product data.

### Bug Fixes

- Ensured consistent and accurate data fetching and hydration across tenant and product views.

### Chores

- Standardized code formatting and import statements for better maintainability.

### File Changes:

- src/app/(app)/(home)/clientProviders.tsx
  - Added new ClientProviders React component for React Query client-side hydration.
- src/app/(app)/(home)/layout.tsx
  - Refactored layout to use named async function, await data prefetch, and wrap content with ClientProviders instead of HydrationBoundary.
- src/app/(app)/(tenants)/tenants/[slug]/(home)/layout.tsx
  - Added new tenant-specific layout component with server-side data prefetch, hydration, navbar, and footer.
- src/app/(app)/(tenants)/tenants/[slug]/(home)/page.tsx
  - Added new tenant-specific page component fetching and displaying filtered products with hydration.
- src/lib/utils.ts
  - Standardized imports, reformatted cn, and added generateTenantURL utility function.
- src/modules/products/server/procedures.ts
  - Extended getMany procedure to support filtering by tenantSlug and include tenant data in product results.
- src/modules/products/ui/components/product-card.tsx
  - Updated to use tenant info (tenantSlug, tenantImageURL), added click handler for tenant navigation, and adjusted skeleton text.
- src/modules/products/ui/components/product-list.tsx
  - Extended props to accept tenantSlug and narrowView, updated query and grid logic, and passed tenant info to product cards.
- src/modules/products/ui/components/views/product-list-view.tsx
  - Updated props to include tenantSlug and narrowView, passing them to child components.
- src/modules/tenants/server/procedures.ts
  - Added new tenantsRouter with getOne procedure for fetching tenant by slug, including image.
- src/modules/tenants/ui/components/footer.tsx
  - Added new Footer component with branding and styling.
- src/modules/tenants/ui/components/navbar.tsx
  - Added new Navbar and NavbarSkeleton components for tenant navigation and loading state.
- src/trpc/routers/\_app.ts
  - Registered tenantsRouter in the main application router.

# Product Page 5/15/25

### Walkthrough:

- This update introduces a server-rendered product detail page that fetches tenant and product data using tRPC and React Query.
- It adds a ProductView component for detailed product display, a reusable StarRating component, and a currency formatting utility.
- Product data structures and API procedures are extended to support a new cover image and refined refund policy options.

### New Features

- Introduced a detailed product view page with server-side data fetching and hydration, displaying product image, name, price, tenant info, star ratings, refund policy, and ratings summary.
- Added a star rating UI component for displaying product ratings.
- Implemented a utility for formatting prices as US dollars.
- Added support for a product cover image.

### Enhancements

- Product links now dynamically include the tenant’s URL.
- Product prices are now formatted using the new currency utility.

### Updates

- Changed refund policy options from plural to singular day forms (e.g., "30 days" → "30 day").

### File Changes:

- src/app/(app)/(tenants)/tenants/[slug]/(home)/products/[productId]/page.tsx
  -Added a new server-side React page component that prefetches tenant and product data, hydrates client cache, and renders the product view.
- src/modules/products/ui/components/views/product-view.tsx
  - Introduced a new ProductView component to display detailed product information, including ratings, pricing, and refund policy.
- src/components/star-rating.tsx
  - Added a new StarRating React component for rendering star-based ratings with optional text.
- src/lib/utils.ts
  - Added a formatCurrency utility function for formatting values as USD currency strings.
- src/modules/products/server/procedures.ts
  - Added a getOne procedure to the products router for fetching a single product with related entities by ID.
- src/modules/products/ui/components/product-card.tsx
  - Updated to use formatCurrency for price formatting and dynamic tenant-based product URLs.
- src/collections/Products.ts src/payload-types.ts
  - Added a cover field to products, updated refund policy options from plural to singular day forms, and updated type definitions accordingly.

# Cart (F.E. only) 5/16/25

- Walkthrough
  - This update introduces a multi-tenant shopping cart system using Zustand for state management and localStorage for persistence. It adds new cart management hooks, store, and UI components for cart and checkout actions. The hydration logic for React Query is simplified by removing a custom provider and using the official HydrationBoundary component. Several components are now dynamically imported to address hydration issues related to localStorage.

### New Features

- Introduced cart functionality supporting multiple tenants, allowing users to add or remove products and view cart contents.
- Added a checkout button that displays the cart item count and links to the tenant-specific checkout page.
- Added a cart button to product views for easy product addition or removal.

### Improvements

- Enhanced reliability of cart and checkout buttons by loading them dynamically on the client, resolving hydration issues.

### Chores

- Added the "zustand" dependency for state management.

### Refactor

- Simplified client hydration by replacing a custom provider with the official React Query hydration boundary.

### File changes:

- package.json Added zustand dependency.
- src/app/(app)/(home)/clientProviders.tsx
  - Deleted custom ClientProviders React component for React Query hydration.
- src/app/(app)/(home)/layout.tsx
  src/app/(app)/(tenants)/tenants/[slug]/(home)/layout.tsx src/app/(app)/(tenants)/tenants/[slug]/(home)/products/[productId]/page.tsx
  - Replaced custom ClientProviders with official HydrationBoundary for React Query hydration; removed related imports and variables.
- src/modules/checkout/hooks/use-cart.ts
  - Added new useCart hook for tenant-scoped cart management.
- src/modules/checkout/store/use-cart-store.ts
  - Added Zustand store useCartStore for multi-tenant cart state, persisted in localStorage.
- src/modules/checkout/ui/components/checkout-button.tsx
  - Added new CheckoutButton component for cart access and checkout navigation.
- src/modules/products/ui/components/cart-button.tsx
  - Added new CartButton component for adding/removing products from the cart.
- src/modules/products/ui/components/views/product-view.tsx
  - Replaced static "Add to cart" button with dynamically imported CartButton to avoid hydration errors.
- src/modules/tenants/ui/components/navbar.tsx
  - Dynamically imported CheckoutButton in Navbar and NavbarSkeleton; added loading state button.

# Checkout - 5/19/25

### Walkthrough

- The changes introduce a dynamic, tenant-specific checkout feature in a React/Next.js application.
- This includes new server and UI components for the checkout flow, a dedicated router and procedure for fetching products and calculating totals, UI components for checkout items and sidebar, and integration of the checkout router into the main API router.
- A bug in the cart hook is also fixed.

### New Features

- Introduced a dynamic, tenant-specific checkout page with a dedicated layout, including consistent navigation and footer.
- Added a checkout view displaying cart items, product details, and total price.
- Implemented sidebar for checkout actions and error handling.
- Added components for individual checkout items and navigation bar with "Continue Shopping" option.

### Bug Fixes

- Fixed an issue where removing a product from the cart would incorrectly add it instead.

### Backend

- Enabled backend support for fetching checkout products and calculating total price.
  Integrated checkout API endpoints into the main application router.

### File changes:

- src/app/(app)/(tenants)/tenants/[slug]/(checkout)/checkout/page.tsx
- Added a dynamic async server page component for tenant-specific checkout, extracting slug from params and rendering CheckoutView.
- src/app/(app)/(tenants)/tenants/[slug]/(checkout)/layout.tsx
  - Introduced a layout component for checkout pages, wrapping content with a Navbar (using slug), main area, and Footer, ensuring consistent structure for tenant checkout routes.
- src/modules/checkout/hooks/use-cart.ts
  - Fixed a bug in the removeProduct function of the useCart hook, ensuring it calls the correct removal logic instead of adding products.
- src/modules/checkout/server/procedures.ts
  - Added a new checkoutRouter with a getProducts procedure: fetches products by IDs, validates existence, populates relations, and computes total price.
- src/modules/checkout/ui/components/checkout-item.tsx
  - Added a CheckoutItem React component for displaying individual checkout items with image, name, tenant, price, and remove button.
- src/modules/checkout/ui/components/checkout-sidebar.tsx
  - Added a CheckoutSidebar React component to display the total price, checkout button, and error message on failure.
- src/modules/checkout/ui/components/navbar.tsx
  - Added a Navbar component for the checkout flow, showing the page title and a "Continue Shopping" link back to the tenant's main page.
- src/modules/checkout/ui/views/checkout-view.tsx
  - Added a CheckoutView component that orchestrates the checkout UI: fetches cart products, handles loading/error/empty states, and renders the checkout grid and sidebar.
- src/trpc/routers/\_app.ts
  - Integrated the new checkoutRouter into the main appRouter, enabling checkout-related API endpoints.

# Stripe integration 5/21/25

### Walkthrough

This update introduces Stripe integration for checkout and order processing. It adds a Stripe webhook handler, a centralized Stripe client, and a new Orders collection in the CMS. Checkout logic is enhanced with a protected purchase mutation, new types, and state management hooks. Several interfaces and prop names are updated for clarity and consistency.

### New Features

- Introduced Stripe integration for handling payments and webhooks.
- Added order management, allowing orders to be tracked and associated with users and products.
- Implemented a purchase flow with checkout session creation and redirection.
- Added a protected procedure for authenticated server-side operations.

### Enhancements

- Improved admin interface display for products and orders.
- Checkout sidebar and view updated for clearer purchase status and actions.

### Bug Fixes

- Ensured robust error handling for unauthorized access and missing data during checkout.

### Developer Experience

- Centralized Stripe client configuration.
- Added new hooks and types for managing checkout state and metadata.

### File changes:

- package.json
  - Added Stripe dependency (stripe@^18.1.1).
- src/app/(app)/(tenants)/tenants/[slug]/(checkout)/layout.tsx
  - Changed params type to a Promise; made Layout async to await params.
- src/app/(app)/api/stripe/webhooks/route.ts
  - Added new API route for handling Stripe webhook events and order creation.
- src/collections/Orders.ts
  - Introduced new Orders collection schema for Payload CMS.
    src/collections/Products.ts Added admin.useAsTitle config to use product name as admin title.
    src/lib/stripe.ts New module exporting a configured Stripe client using env secret and API version.
- src/modules/checkout/hooks/use-checkout-states.ts
  - Added useCheckoutState hook for managing checkout query parameters.
- src/modules/checkout/server/procedures.ts
  - Added protected purchase mutation to checkoutRouter for Stripe checkout session creation.
- src/modules/checkout/types.ts
  - Added types: ProductMetadata, CheckoutMetadata, ExpandedLineItem for checkout.
- src/modules/checkout/ui/components/checkout-sidebar.tsx
  - Renamed props: onCheckout → onPurchase, isPending → disabled. Updated usages accordingly.
- src/modules/checkout/ui/views/checkout-view.tsx
  - Integrated purchase mutation, checkout state management, and updated sidebar props/logic.
- src/payload-types.ts
  - Added orders collection/types, reordered interfaces, updated select interfaces and relations.
- src/payload.config.ts
  - Reordered and updated collection imports; added Orders to Payload config.
- src/trpc/init.ts
  - Added protectedProcedure for authentication in TRPC; updated imports.

# Library 5/22/25

### Walkthrough

- This update introduces a complete "Library" feature, including backend procedures, API routing, server/client data fetching, and UI components for displaying a user's purchased products. It also enhances product detail and cart button components to reflect purchase status, optimizes cart state management, and updates API routers to integrate the new library module.

### New Features

- Introduced a personal library page displaying your purchased products and reviews.
- Added product cards and a responsive product list with infinite scrolling in the library.
- Added skeleton loaders for product cards and lists to improve loading experience.
- Added a "View in library" button for purchased products, allowing quick access from product pages.

### Enhancements

- Improved cart button behavior to show library access for purchased items.
- Enhanced product detail view to indicate purchase status.

### Bug Fixes

- Optimized cart state handling for better performance and reduced unnecessary re-renders.

### Chores

- Updated internal API routing to support new library features.

### File changes:

- src/app/(app)/(library)/library/page.tsx
  - Added a new server-side React page component that prefetches library data using React Query and tRPC, hydrates it for the client, and renders the LibraryView.
- src/modules/library/server/procedures.ts
  - Introduced libraryRouter with a protected getMany procedure to fetch a user's purchased products, supporting pagination and detailed product/tenant typing.
- src/modules/library/ui/components/product-card.tsx
  - Added ProductCard component for displaying product info in card format and ProductCardSkeleton for loading states.
- src/modules/library/ui/components/product-list.tsx
  - Added ProductList component for paginated, infinite-scroll display of products using React Query, and ProductListSkeleton for loading placeholders.
- src/modules/library/ui/views/library-view.tsx
  - Added LibraryView component to render the library page layout, including navigation, headers, and a suspense-wrapped product list.
- src/modules/checkout/hooks/use-cart.ts
  - Refactored useCart hook for improved memoization and shallow state selection, replacing direct store calls with selectors and useCallback for handlers.
- src/modules/checkout/store/use-cart-store.ts
  - Removed getCartByTenant method from CartState and its implementation; store initializer updated accordingly.
- src/modules/products/server/procedures.ts
  - Enhanced getOne product procedure to check user authentication and purchase status, returning an isPurchased flag in the product response.
- src/modules/products/ui/components/cart-button.tsx
  - Added isPurchased prop to CartButton; renders a "View in library" button linking to the product in the library if purchased, otherwise retains original cart toggle behavior.
- src/modules/products/ui/components/views/product-view.tsx
  - Updated ProductView to pass the new isPurchased prop from product data to the CartButton component.
- src/modules/home/ui/components/search-filters/search-input.tsx
  - Reordered some JSX props and added prefetch to a Link component; no logic or control flow changes.
- src/trpc/routers/\_app.ts
  - Added libraryRouter to the main appRouter, fixed router ordering, and removed duplicate checkoutRouter entry.

# Reviews - 5/28/25

### Walkthrough

- This change introduces a complete user review system for products, including backend collections, API procedures, type definitions, and frontend components for submitting, editing, and displaying reviews. It also adds a product detail page in the library section with server-side data prefetching, hydration, and integration of the new review sidebar and form.

### New Features

- Introduced product review functionality, allowing users to submit, edit, and view reviews with ratings for products in their library.
- Added interactive star rating picker for submitting product ratings.
- Product pages now display user reviews and provide a sidebar for review management.
- Enhanced product page navigation with server-side data fetching and improved prefetching for faster loading.

### Bug Fixes

- Minor whitespace cleanup in the sign-up view for improved UI consistency.

### Chores

- Integrated the new reviews collection into the backend configuration and type system.

### Files changes:

- src/collections/Reviews.ts, src/payload.config.ts, src/payload-types.ts
  - Added Reviews collection to CMS config and type system, defining review fields and relationships.
- src/modules/reviews/server/procedures.ts, src/modules/reviews/types.ts
  - Introduced reviewsRouter with getOne, create, and update procedures and corresponding output type.
- src/trpc/routers/\_app.ts
  - Registered reviewsRouter in the main TRPC app router.
- src/components/star-picker.tsx
  - Added StarPicker component for interactive star-based rating input.
- src/modules/library/ui/components/review-form.tsx, src/modules/library/ui/components/review-sidebar.tsx
  - Added ReviewForm and ReviewSidebar components for review creation, editing, and display.
- src/modules/library/ui/views/product-view.tsx
  - Added ProductView component with product info and integrated review sidebar.
- src/app/(app)/(library)/library/[productId]/page.tsx
  - Added server component page for product detail with server-side data prefetch and hydration.
- src/modules/library/server/procedures.ts
  - Added getOne protected procedure for fetching a user's product in the library.
- src/modules/library/ui/components/product-card.tsx
  - Enabled prefetching on product card links for smoother navigation.
- src/modules/checkout/ui/views/checkout-view.tsx
  - Enhanced checkout flow to invalidate library queries and route to /library after purchase.
- src/modules/auth/ui/views/sign-up-view.tsx
  - Removed an extraneous whitespace literal in the store URL preview.
