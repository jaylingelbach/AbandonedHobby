# Changes I may want to make:

- Checkout-view.tsx on success where do I want to route? Currently routing to library.
- prevent user from buying their own products.
- referral codes for influencers to give out. they get a % and the user a reduced fee?
- a good way to navigate home in the header in a store or product/checkout flow.
- rethink all button. (possibly confusing with view all.) Currently all just redirects from whatever category is selected to abandonedhobby.com/ instead of /${category}/${slug}. I think the slug for all is all
- View all should possibly open on hover instead of just on click? But if hover, it pops up to the left and might be annoying if you move mouse off of the button. so I think it uses state to change to open, maybe there is a non annoying way to do that... dunno. Jess was confused by it.
- Message notifications. Email? Just an inbox symbol with the number of messages?

# BUGS:

- If an admin puts a product in a cart it is seen sitewide.
- If session expires while product in cart and you go to checkout. with subdomain routing enabled, you redirect to tenant.abandonedhobby.com/sign-in (404), instead of abandonedhobby.com/sign-in.
- no good error when I get a "Application error: a client-side exception has occurred while loading abandonedhobby.com (see the browser console for more information)." when a users session expires and they try to refresh a page (library). Just a blank page that says that instead of redirecting to sign in.

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

# Review aggregation 5/28/25

### Walkthrough

- The changes enrich product and library server procedures to include review summary data—average rating, review count, and rating distribution—when fetching products. UI components are updated to display these dynamic review metrics instead of static placeholders. Additionally, a clipboard copy feature with user feedback is added to the product view page.

### New Features

- Added a clipboard copy button for product URLs with user feedback, including a success notification and visual indicator.

### Enhancements

- Product cards and lists now display real review ratings and counts based on actual data instead of static values.
- Product detail views show accurate average ratings and review counts, along with a dynamic ratings breakdown reflecting real review distribution.

### Style

- Removed outdated comment lines regarding ratings from product card components.

### File changes:

- src/modules/library/server/procedures.ts
  - Enriches product data in getOne and getMany with review count and average rating from reviews.
- src/modules/products/server/procedures.ts
  - Adds review summary (average, count, distribution) to getOne and getMany product procedures.
- src/modules/library/ui/components/product-card.tsx src/modules/products/ui/components/product-card.tsx
  - Removes placeholder comment about adding real ratings.
- src/modules/library/ui/components/product-list.tsx src/modules/products/ui/components/product-list.tsx
  - Updates ProductCard props to use actual review data instead of hardcoded values.
- src/modules/products/ui/components/views/product-view.tsx
  - Adds clipboard copy button with toast feedback; displays dynamic review data and rating distribution.

# Access Control 5/29/25

### Walkthrough

- This update introduces granular access control across multiple collection configurations, primarily restricting create, update, and delete operations to super administrators. A utility function isSuperAdmin is added to centralize role checks. Additional improvements include new fields, admin UI visibility controls, dependency updates, editor formatting settings, and enhanced type documentation.

### New Features

- Introduced stricter access controls across collections, restricting create, update, and delete operations to super admins in most cases.
- Added conditional admin UI visibility for several collections, hiding them from non-super-admin users.
- Added a protected "content" field to products, visible only after purchase.

### Improvements

- Enhanced admin UI descriptions for various fields to provide clearer guidance.
- Product view now conditionally displays special content if available.

### Documentation

- Improved type documentation and comments for better clarity in code interfaces.

### File Changes:

- package.json
- Updated eslint-config-next version range
- added eslint-config-prettier and eslint-plugin-import to devDependencies.
- src/lib/access.ts
  - Added isSuperAdmin utility function for role checking.
- src/payload.config.ts
  - Refactored imports, applied isSuperAdmin in multi-tenant config, and added a clarifying comment.
- src/payload-types.ts
  - Added/expanded documentation comments; added optional content field to Product and related types.
- src/collections/Categories.ts src/collections/Tags.ts
  - Added access controls: only super admins can create, update, delete; admin UI hidden for non-super admins.
- src/collections/Media.ts
  - Restricted delete access to super admins; admin UI hidden for non-super admins.
- src/collections/Orders.ts
  - Restricted all CRUD operations to super admins; added admin description to Stripe session field.
- src/collections/Products.ts
  - Added access controls; new content textarea field; TODO for RichText; conditional create based on tenant status.
- src/collections/Reviews.ts
  - Restricted all CRUD operations to super admins.
- src/collections/Tenants.ts
  - Restricted create/delete to super admins; field-level update restrictions; updated admin descriptions.
- src/collections/Users.ts
  - Tightened access to super admins for most actions; updated roles and tenant array field access; admin UI hidden for non-super admins.
- src/modules/checkout/server/procedures.ts
  -     Refactored import statements and array mapping formatting; no logic changes.
- src/modules/library/ui/views/product-view.tsx
  - Now conditionally renders product content if available; otherwise shows fallback message.
- src/modules/products/server/procedures.ts
  - Excluded content field from product queries; compacted formatting.
- src/modules/products/ui/components/views/product-view.tsx
  - Reformatted JSX and logic for brevity; no functional changes.

# Stripe connect 6/2/25

### Walkthrough

- This update introduces a Stripe account verification flow for tenants, including a new React page and component for initiating verification, backend mutations to generate onboarding links, and webhook handling for Stripe account updates. The Orders schema is updated to track Stripe account IDs, and platform fee calculations are added to checkout. Admin UI and seed scripts are also adjusted for Stripe integration.

### New Features

- Added Stripe account verification flow, including onboarding and status checks for tenants.
- Introduced a UI component prompting users to verify their account for payouts.
- Verification status is now shown in the admin interface before navigation links.

### Enhancements

- Platform fee percentage is now configurable.
- Orders now explicitly track both the Stripe account ID and checkout session ID.
- Product listings require account verification, with clear admin descriptions.

### Bug Fixes

- Improved error logging and handling in the seeding script and during registration.

### Other

- Updated webhook handling to support additional Stripe events and synchronize verification status.
- Improved admin UI configuration and collection field organization.

### File changes:

- src/app/(app)/(tenants)/stripe-verify/page.tsx
  - New client page triggers Stripe verification on mount via TRPC mutation; redirects based on result; shows loader during process.
- src/components/stripe-verify.tsx
  - New StripeVerify React component displays a prompt and button for account verification if Stripe details are missing; exported as named and default export.
- src/app/(payload)/admin/importMap.js, src/payload.config.ts
  - Admin UI updated: imports and registers StripeVerify before nav links; import map and config formatting improved.
- src/app/(app)/api/stripe/webhooks/route.ts
  - Webhook now handles account.updated events to update tenant Stripe verification status; checkout.session.completed event updated to include stripeAccountId in orders and uses stripeAccount option.
- src/collections/Orders.ts, src/payload-types.ts
  - Orders schema: splits stripeCheckoutSessionId (now optional) from new required stripeAccountId; types updated accordingly.
- src/collections/Products.ts, src/payload-types.ts
  - Products collection and Tenant type: admin description/comment added requiring account verification before listing products.
- src/constants.ts
  - Adds PLATFORM_FEE_PERCENTAGE constant (10).
- src/lib/seed.ts
  - Seed script now creates a Stripe account for the admin tenant and logs errors in more detail.
- src/modules/auth/server/procedures.ts
  - During registration, creates a Stripe account for the new tenant and normalizes tenant slug; stores Stripe account ID.
- src/modules/checkout/server/procedures.ts
  - Adds verify mutation for onboarding link; purchase mutation now checks Stripe verification, calculates platform fee, and passes relevant Stripe account/session info.

# 6/4/25

### Walkthrough

- This update introduces rich text support for product descriptions and content, adds isArchived and isPrivate fields to products, and refines access control. Product and review views now use React Suspense with skeleton fallbacks for loading states. Several import paths are updated, and dependencies are upgraded or added.

### New Features

- Added skeleton loading states for product and review views, improving user experience during data loading.
- Introduced a dedicated error page for product errors.
- Enhanced product descriptions and content with rich text formatting.
- Added options to archive or make products private, allowing greater control over product visibility.

### Improvements

- Product views and sidebars now use suspense boundaries for smoother loading transitions.
- Product filtering now excludes archived and private products where appropriate.
- Richer content display for product details using enhanced rich text rendering.

### Dependency Updates

- Updated rich text editor dependency and added a new error boundary dependency.

### Admin Enhancements

- Expanded admin import map with new rich text and multi-tenant features.

### Other

- Minor UI and text adjustments for clarity and consistency.

### File changes:

- package.json
  - Upgraded @payloadcms/richtext-lexical to ^3.40.0, added react-error-boundary dependency.
- src/app/(app)/(home)/[category]/[subcategory]/page.tsx, src/app/(app)/(home)/[category]/page.tsx, src/app/(app)/(home)/page.tsx, src/app/(app)/(tenants)/tenants/[slug]/(home)/page.tsx
  - Updated import paths for ProductListView.
- src/app/(app)/(library)/library/[productId]/page.tsx, src/app/(app)/(tenants)/tenants/[slug]/(home)/products/[productId]/page.tsx
  - Wrapped ProductView in React Suspense with ProductViewSkeleton as fallback.
- src/app/(app)/(tenants)/tenants/[slug]/(home)/products/[productId]/error.tsx
  - Added new ErrorPage component for error handling UI.
- src/app/(payload)/admin/importMap.js
  - Added multiple new import mappings for @payloadcms/richtext-lexical features and multi-tenant plugin.
- src/collections/Products.ts
  - Switched description and content to rich text, added isArchived and isPrivate fields, removed update access rule.
- src/components/stripe-verify.tsx
  - Simplified early return and added inline styles to the returned element.
- src/modules/auth/server/procedures.ts
  - Enhanced Stripe account creation with detailed parameters and improved logging/error handling in register.
- src/modules/checkout/server/procedures.ts
  - Filtered out archived products in queries and updated error message wording.
- src/modules/checkout/ui/views/checkout-view.tsx
  - Removed a trailing space in a "No products found" message.
- src/modules/library/ui/components/product-card.tsx
  - Removed a trailing blank line.
- src/modules/library/ui/components/review-form.tsx
  - Removed default export, added ReviewFormSkeleton named export.
- src/modules/library/ui/components/review-sidebar.tsx
  - Changed ReviewForm import from default to named import.
- src/modules/library/ui/views/product-view.tsx
  - Wrapped ReviewSidebar in Suspense with ReviewFormSkeleton fallback, used RichText for content, added ProductViewSkeleton.
- src/modules/products/server/procedures.ts
  - Excluded archived and private products in queries, added archived check in getOne, minor formatting.
- src/modules/products/ui/views/product-list-view.tsx
  - Updated imports for child components to use components subdirectory.
- src/modules/products/ui/views/product-view.tsx
  - Used RichText for description, fixed import paths, added optional chaining, introduced ProductViewSkeleton.
- src/payload-types.ts
  - Updated Product and ProductsSelect interfaces for rich text fields and new boolean flags.
- src/payload.config.ts
  - Removed import for StripeVerify, minor comment punctuation fix.

# Subdomains 6/4/25

### Walkthrough

- This update introduces middleware for tenant-based routing by rewriting URLs based on subdomains, integrates a utility for generating tenant-specific URLs, and applies this utility across authentication and checkout modules. It also updates footer components and domain references for consistency, and includes minor documentation and import adjustments.

### New Features

- Introduced middleware to enable tenant-specific routing based on subdomains.

# Improvements

- Tenant URLs are now dynamically generated for more accurate domain handling.
- Footer links and text updated to reflect consistent branding ("abandoned hobbies, inc").
- Username preview and documentation updated to use ".abandonedhobby.com" for clarity.

### Bug Fixes

- Minor typo corrected in footer component styling.

### Documentation

- Updated descriptions and examples to improve clarity regarding tenant subdomains and features.

### File changes:

- src/middleware.ts
  - Added middleware for subdomain-based tenant routing with path exclusions and debug logging.
- src/lib/utils.ts
  - Updated generateTenantURL to construct full URLs based on environment and tenant slug.
- src/modules/auth/server/procedures.ts, src/modules/checkout/server/procedures.ts
  - Replaced static URL construction with generateTenantURL for Stripe and registration flows.
- src/app/(app)/(tenants)/tenants/[slug]/(checkout)/layout.tsx, src/app/(app)/(tenants)/tenants/[slug]/(home)/layout.tsx
  - Read and log NEXT_PUBLIC_APP_URL; pass as prop to Footer.
- src/modules/tenants/ui/components/footer.tsx
  - Footer now accepts appUrl prop, updates link and text, and fixes className typo.
- src/modules/home/ui/components/footer.tsx
  - Changed footer text capitalization ("Inc" to "inc").
- src/modules/auth/ui/views/sign-up-view.tsx
  - Updated domain suffix in username preview from ".shop.com" to ".abandonedhobby.com".
- src/collections/Tenants.ts, src/payload-types.ts
  - Updated example subdomain references from "[slug]" to "[username]".
- src/modules/auth/utils.ts
  - Added commented-out cookie options for future cross-domain support.
- src/app/(app)/(library)/library/[productId]/page.tsx
  - Changed import style for ProductView and ProductViewSkeleton.
- recap.md
  - Added improvement note to prevent users from buying their own products.

# Deployment to Vercel 6/4/25

### Walkthrough

- This update introduces dynamic rendering to several Next.js page modules by exporting a dynamic constant. It updates the Stripe API version in the Stripe client initialization, refines type definitions and prop interfaces, improves debounce logic and state updates in a dropdown component, and makes minor import and configuration adjustments for ESLint and TRPC.

### New Features

- Improved dynamic rendering for sign-in, sign-up, and library pages, ensuring they are always rendered dynamically.

### Improvements

- Updated Stripe integration to use the latest API version.
- Enhanced stability and correctness of dropdown filter interactions for a smoother user experience.
- The product filter component now allows the className property to be optional, making it easier to use.

### Bug Fixes

- Corrected product type definitions to better match the data structure.

### Chores

- Updated internal configuration and cleaned up unused imports.

### File changes:

- src/app/(app)/(auth)/sign-in/page.tsx src/app/(app)/(auth)/sign-up/page.tsx src/app/(app)/(library)/library/[productId]/page.tsx src/app/(app)/(library)/library/page.tsx
  - Added export const dynamic = 'force-dynamic'; to explicitly set dynamic rendering for pages.
- src/lib/stripe.ts
  - Updated Stripe API version from '2025-04-30.basil' to '2025-05-28.basil'.
- src/modules/products/types.ts
  - Changed type alias: ProductsGetManyOutputSingle now references docs[0] instead of [0].
- src/modules/products/ui/components/product-filters.tsx
  - Made className prop in ProductFilterProps optional.
- src/modules/home/ui/components/search-filters/category-dropdown.tsx
  - Switched from useCallback to useMemo for debounce, improved state update logic and cleanup.
- src/modules/auth/ui/views/sign-up-view.tsx
  - Added import for z from zod.
- src/modules/library/server/procedures.ts
  - Removed unused baseProcedure import.
- eslint.config.mjs
  - Replaced compat.extends with compat.config for configuration style.

  ### Vercel deployment lesson learned:
  - When setting env vars for public domain or root url DO NOT INCLUDE A TRAILING /
    - it will ruin your day.

# Messaging 7/6/25

### Walkthrough

- This update introduces a complete real-time messaging system with conversations and messages, integrating Liveblocks for collaborative chat, Payload CMS for data persistence, and tRPC for API routing. New UI components and hooks enable chat initiation, modal chat windows, and a full chat page. Supporting schemas, access control, and type definitions are added throughout the backend and frontend.

### New Features

- Introduced real-time chat functionality, allowing users to initiate and participate in conversations about products.
- Added chat modals and chat room components for seamless in-app messaging between buyers and sellers.
- Integrated Liveblocks for real-time collaborative messaging with new React hooks and context providers.
  Added new collections for Conversations and Messages in the admin interface.
- Implemented user authentication and authorization for chat sessions.
- Added user and message management APIs with secure access controls.
- Introduced React hooks for user session management and conversation handling.

### Improvements

- Enhanced About page with detailed information and improved layout.
- Updated branding and site text to consistently use "Abandoned Hobby".

### Bug Fixes

- Minor text corrections in navigation, footer, and authentication views.

### Chores

- Added and configured new dependencies for Liveblocks and Radix UI.
- Updated and documented future UI/UX improvements in recap notes.

### Style

- Standardized code formatting and style in sidebar components.

### File changes:

- src/collections/Conversations.ts, src/collections/Messages.ts, src/payload.config.ts
  - Introduced new Payload CMS collections for conversations and messages; registered them in CMS config.
- src/payload-types.ts
  - Added type definitions and select interfaces for conversations and messages, integrating them into the Payload type system.
- src/modules/conversations/server/procedures.ts
  - Added tRPC router for conversations with a protected mutation to get or create a conversation by buyer, seller, and product.
- src/modules/messages/server/procedures.ts, src/modules/messages/server/schemas.ts
  - Added tRPC router and validation schemas for message operations: get conversation, send message, get paginated messages, mark messages as read.
- src/trpc/routers/\_app.ts
  - Registered new conversations, messages, and users routers in the main app router.
- src/lib/get-auth-user.ts, src/trpc/server-context.ts
  - Added server-side utilities for authenticating users and providing TRPC context, supporting header-based session retrieval.
- src/app/api/liveblocks-auth/route.ts
  - Added API route for authenticating and authorizing users for Liveblocks sessions, with access control based on room participants.
- liveblocks.config.ts, src/lib/liveblocks-provider.tsx, src/components/providers/liveblocks-wrapper.tsx, src/lib/liveblocks.ts
  - Added Liveblocks configuration, provider setup, and a wrapper component for enabling real-time collaboration in the app.
- src/modules/messages/ui/chat-room.tsx
  - Implemented a real-time chat room UI with Liveblocks for shared state, optimistic updates, and backend persistence.
- src/modules/conversations/ui/chat-button-with-modal.tsx, src/modules/conversations/ui/chat-modal.tsx
  - Added components for initiating chat, opening chat modals, and managing chat session state.
- src/modules/products/ui/views/product-view.tsx
  - Integrated chat initiation and chat room display into the product view, allowing users to start conversations with sellers.
- src/app/(app)/chat/[conversationId]/page.tsx
  - Added a full chat page rendering a chat room for a given conversation.
- src/app/(app)/layout.tsx
  - Wrapped app content in Liveblocks provider; updated metadata and favicon.
- src/hooks/use-user.ts
  - Added a hook for retrieving the current user session and login state.
- package.json
  - Added dependencies for Liveblocks and Radix UI visually hidden component.
- src/app/api/layout.tsx
  - Added a root layout for the API route segment.
- src/app/(payload)/admin/importMap.js
  - Added import mapping for a multi-tenant collection watcher.
- recap.md
  - Added notes for potential UI/UX improvements in navigation and button behavior.
- src/lib/seed.ts
  - Changed category name for clarity in filter UI.
- src/collections/Products.ts
  - Removed extraneous blank/comment lines.
- src/components/ui/sidebar.tsx
  - Reformatted code for stylistic consistency (single quotes, semicolons, spacing).
- src/modules/auth/ui/views/sign-in-view.tsx, src/modules/auth/ui/views/sign-up-view.tsx, src/modules/home/ui/components/navbar.tsx, src/modules/home/ui/components/footer.tsx, src/modules/tenants/ui/components/footer.tsx
  - Updated branding text from "Abandoned Hobbies" to "Abandoned Hobby" in various UI components.
- src/modules/users/server/procedures.ts
  - Added users router with a protected procedure to fetch user details by ID.

# Search Filters 7/8/25

### Walkthrough

- A debounced search filter was added to the product filtering system. The SearchInput component is now controlled and updates the global filter state with a debounce. The search parameter is propagated through hooks, query parameters, and server logic, allowing product filtering by name. The SearchInput is wrapped in a React Suspense boundary.

### New features

- Added the ability to filter products by a search term, allowing users to find products by name.
- Introduced a search input in the product filters with improved responsiveness through debounced updates.

### Improvements

- Enhanced the loading experience of the search input with asynchronous handling for smoother interactions.

### File changes:

- src/modules/home/ui/components/search-filters/index.tsx
  - Wrapped SearchInput with React Suspense; integrated useProductFilters hook to manage filter state and pass search props.
- src/modules/home/ui/components/search-filters/search-input.tsx
  - Made SearchInput controlled with defaultValue and onChange props; added debounce effect for onChange calls; removed default export and 'use client';.
- src/modules/products/hooks/use-product-filters.ts
  - Added search string parameter to filter state with default and clear-on-default options.
- src/modules/products/search-params.ts
  - Added search string parameter to product filter query params; formatting update for tags.
- src/modules/products/server/procedures.ts
  - Extended getMany input schema and query logic to support filtering products by search (partial name match).
- src/modules/products/ui/components/product-filters.tsx
  - Changed import path of useProductFilters hook to absolute import; no functional changes.

  # Message Notifications 7/25/25

  ### Walkthrough
  - A notifications system was implemented across the application. This includes a new notifications collection with access control, automatic notification creation when messages are sent, unread notification counting via a tRPC endpoint, and a UI badge in the Navbar displaying unread message counts. Associated type definitions and collection registration updates were also made.

  ### New features

- Introduced in-app notifications for messages, automatically notifying users when they receive a new message.
- Added a notifications collection with support for unread status and access control.
- Displayed an unread message indicator with a badge in the navigation bar.
- Provided an API endpoint to fetch the count of unread notifications for the current user.

### File changes:

- src/collections/Notifications.ts
  - Added new Notifications collection with schema, access control, and admin UI config.
- src/collections/Messages.ts
  - Added afterChange hook to create notifications for message receivers on message creation.
- src/modules/notifications/server/procedures.ts
  - Introduced notificationsRouter with unreadCount procedure for current user's unread notifications.
- src/modules/home/ui/components/navbar.tsx
  - Enhanced Navbar to display unread notifications badge using unreadCount query.
- src/payload-types.ts
  - Added Notification interfaces, updated Config types, and extended PayloadLockedDocument.
- src/payload.config.ts
  - Registered Notifications collection in Payload CMS config.
- src/trpc/routers/\_app.ts
  - Integrated notificationsRouter into the main appRouter.

# Home button in nav bar 7/30/25

### Walkthrough

- This update introduces a new ESLint configuration, enhances editor auto-fix settings, adds a lint fix script and updates a dependency version, refines a user-facing label in the sign-up view, and restructures the Navbar component to use a grid layout with a new home icon link and improved alignment.

### New Features

- Added a home icon link to the left side of the navigation bar for quick access to the homepage.
- Introduced a new script to automatically fix linting issues in project files.

### Improvements

- Updated the navigation bar layout for better alignment and usability.
- Enhanced the form description in the sign-up view to clarify account/store availability.
- Improved import order and formatting consistency across the codebase.
- Editor now applies all available source fixes automatically on save.

### Chores

- Upgraded a development dependency for improved linting support.

### File changes:

- ESLint Configuration
  - .eslintrc.js Introduces a new ESLint configuration file with plugins, extended rulesets, and a detailed import order rule for code style enforcement.
- Editor Settings
  - .vscode/settings.json Adds "source.fixAll": "always" to enable all possible source code fixes on save, in addition to ESLint-specific fixes.
- Linting Script & Dependency Update
  - package.json Adds a "lint:fix" npm script for auto-fixing lint issues, updates eslint-plugin-import version, and adds a trailing comma to the scripts section.
- Sign-Up View Label Update
  - src/modules/auth/ui/views/sign-up-view.tsx Updates the form description label to "Your account/store will be available at" for improved clarity to users.
- Navbar Layout Refactor
  - src/modules/tenants/ui/components/navbar.tsx Refactors Navbar from flexbox to grid layout, introduces a home icon link, centers tenant info, right-aligns the checkout button, simplifies image source logic, and reorganizes imports.

# Fix read access for notifications and Home button in CMS 7/31/25 bug/fix/update-notification

### Walkthrough

- This update introduces a new AbandonedHobbyLink React component, relocates the StripeVerify component to a custom directory, and updates import paths and admin configuration to register both components in the admin panel. Additionally, the access control logic for the Notifications collection is refined to correctly restrict read permissions based on user ownership.

### New Features

- Added a new "Abandoned Hobby Link" component, providing a prominent Home link in the interface.
- Introduced a Stripe verification prompt that alerts users to verify their Stripe account if required.

### Improvements

- Updated admin navigation to display both the Stripe verification prompt and the new Home link.
- Enhanced notification privacy by ensuring users can only view notifications relevant to them, with super admins retaining full access.

### File changes:

- Admin Import Map & Config Updates
  - src/app/(payload)/admin/importMap.js, src/payload.config.ts
    - Updated import paths for StripeVerify to its new location and added AbandonedHobbyLink to the import map and admin beforeNavLinks configuration, enabling both components in the admin UI.
- New Custom Components
  - src/components/custom-payload/abandoned-hobby-link.tsx, src/components/custom-payload/stripe-verify.tsx
    - Introduced two new React components: AbandonedHobbyLink (renders a styled home link) and StripeVerify (prompts users to verify their Stripe account if missing), both exported with force-dynamic rendering.
- Notifications Access Control
  - src/collections/Notifications.ts
    - Corrected the read access control logic to filter notifications by user ownership rather than comparing notification and user IDs. Super admins retain universal access. No changes to other access rules.

# Postmark Integration 08/04/25

### Walkthrough

- This update introduces email sending capabilities using Postmark, including new scripts and utilities for sending test and order confirmation emails. The TRPC context and middleware handling are refactored for unified context propagation and authentication. Additional logging is added to Stripe webhook handling, and minor admin UI and notification query adjustments are made.

### New Features

- Added email sending functionality, including a utility for sending transactional emails and an automated confirmation email when a new order is created.
- Introduced a script to test email sending.

### Improvements

- Enhanced webhook logging for Stripe events to aid in monitoring and debugging.
- Updated unread notification count logic for more accurate results.
- Improved TRPC context handling for more robust authentication and context propagation.
- Clarified notification data handling in the navbar component.

### Admin UI

- Notifications collection is now hidden from the admin interface.

### Chores

- Updated and added dependencies for email functionality and TypeScript tooling.
- Minor code cleanup and comment removal.

File Changes:

- Email Sending Feature
  - package.json, src/lib/sendEmail.ts, scripts/test-email.ts, src/collections/Orders.ts
    - Adds Postmark dependency and TypeScript tooling; introduces a utility for sending emails; adds a test script; implements an order confirmation email sent after order creation.
- TRPC Context Refactor
- src/trpc/init.ts
  - Refactors context creation to include db, headers, and session; updates TRPC initialization and middleware for unified context and authentication handling.
- Stripe Webhook Logging
  - src/app/(app)/api/stripe/webhooks/route.ts
    - Adds detailed console logging to webhook handler for event tracking and debugging.
- Admin UI and Notification Query
  - src/collections/Notifications.ts, src/modules/notifications/server/procedures.ts
    - Hides Notifications collection in admin UI; updates unread notification count logic to use a find query with explicit filters.
- UI Type Clarification
  - src/modules/home/ui/components/navbar.tsx
    - Adds explicit type assertion for notification count data to clarify expected data shape.
- Minor Cleanup
  - src/lib/get-auth-user.ts
    - Removes a redundant comment line.

# Sale Confirmation email 08/07/25

### Walkthrough

- This update restores and enhances email notification logic in the Stripe webhook handler, adding validation for customer shipping details and improving payment information accuracy. Additional changes include reordering imports in an admin import map, updating a link label, and configuring a new admin UI component to render before the login screen.

### New Features

- New Features

- Added a custom "Abandoned Hobby" link before the login screen in the admin interface. (Payload CMS).

- Enhanced email notifications for order confirmations and sales with improved validation and detailed customer and payment information.

# Style

- Updated the home link label from "Home" to "Abandoned Hobby" in the interface.

# Chores

- Adjusted import order for consistency in admin import mapping.

### File changes

- Stripe Webhook Email Handling
  - src/app/(app)/api/stripe/webhooks/route.ts
    - Restored and improved email sending logic for order confirmations and sale notifications, added validation for customer shipping fields, integrated payment intent and charge retrieval, and updated shipping/payment info in emails.
- Admin Import Map Reordering
  - src/app/(payload)/admin/importMap.js
    - Reordered import and importMap entry for StripeVerify to follow AbandonedHobbyLink, with no functional or logic changes.
- Custom Payload Link Label
  - src/components/custom-payload/abandoned-hobby-link.tsx
    - Changed visible link text from "Home" to "Abandoned Hobby"; all other aspects remain unchanged.
- Admin UI Component Configuration
- src/payload.config.ts
  - Added beforeLogin array to admin UI components configuration, including the AbandonedHobbyLink component to be rendered before the login screen; minor formatting adjustment to beforeNavLinks.

# Welcome email 8/12/25

### New features

- Seller sale notification emails and Postmark welcome emails; admin seeding ensures admin user/tenant.
- Tenant-aware storefronts, per-tenant branding/navigation, and pre-login admin link.
- Library for purchased products, in-app notifications, and chat.

### Improvements

- Checkout enforces single-seller carts and performs seller-specific checkout/redirects.
- Dynamic rendering for sign-in, sign-up, and library pages.
- Richer product pages, debounced search, tag filtering, and sorting.

- Payments
  - Tenant Stripe onboarding/verification, improved webhook validation, richer receipts/shipping details, and platform-fee support.

- Access Control
  - Stricter admin visibility and super-admin checks.

### File changes:

- Stripe webhooks & email helpers
  - src/app/(app)/api/stripe/webhooks/route.ts, src/lib/sendEmail.ts
    - Verify Stripe webhook signatures; resolve tenant/seller from session metadata or event.account; create Orders and extract payment/charge details; send seller sale notifications via Postmark; add sendWelcomeEmailTemplate; rename sale payload field to sellerName; unify From address; improve logging and error handling.
- Tenants schema & payload types
  - src/collections/Tenants.ts, src/payload-types.ts
    - Add primaryContact (relationship to users), notificationEmail, notificationName to Tenants; restrict update access to super-admin; expose new Tenant fields/selectors in payload types.
- Users schema, hook & types
  - src/collections/Users.ts, src/payload-types.ts
    - Add firstName, lastName, welcomeEmailSent; add afterChange hook to send welcome email on create and set welcomeEmailSent; update types/selectors.
- Auth: validation, server, UI
  - src/modules/auth/schemas.ts, src/modules/auth/server/procedures.ts, src/modules/auth/ui/views/sign-up-view.tsx
    - Add required firstName/lastName to register schema and SignUp UI; persist names and welcomeEmailSent on user creation; create tenant with notification fields and patch primaryContact to new user to link tenant↔user.
- Checkout flow, types & UI mutation
  - src/modules/checkout/server/procedures.ts, src/modules/checkout/types.ts, src/modules/checkout/ui/views/checkout-view.tsx
    - Remove tenantSlug from purchase input; derive seller from product tenant refs, enforce single-seller carts, require seller Stripe account; create Checkout Session on connected account with metadata (userId, tenantId, tenantSlug, sellerStripeAccountId, productIds); compute rounded pricing; frontend mutation drops tenantSlug.
- Next.js dynamic pages
  - src/app/(app)/(auth)/sign-in/page.tsx, src/app/(app)/(auth)/sign-up/page.tsx, src/app/(app)/(library)/library/page.tsx, src/app/(app)/(library)/library/[productId]/page.tsx
    - Export export const dynamic = 'force-dynamic' on these pages to force dynamic rendering.
- Seed & admin linking
  - src/lib/seed.ts
    - Seed flow becomes admin-user–driven: ensure admin user exists (creates if missing), create/verify admin tenant with Stripe account, set primaryContact and notificationEmail, and link admin tenant to admin user; improved logging and password enforcement.

# Small changes filed under bugs 8/13/25

### Walkthrough

- Removed header comment lines in several files, simplified inline comments and one seed category label, added a required support_email field to the welcome-email type and template payload, updated the users collection to pass support_email and a static sender_name to the welcome-email call, and applied a Poppins font styling to the footer.

### New Features

- Welcome emails now include a visible support email address.

- Style
  - Updated footer typography to use the Poppins font.
  - Removed redundant header comments across multiple files.
- Chores
  - Simplified inline comments and updated a seed category label ("All categories"); no functional or API changes.

### File changes:

- Header comment cleanup
  - src/app/(app)/layout.tsx, src/app/api/liveblocks-auth/route.ts, src/collections/Notifications.ts, src/components/providers/liveblocks-wrapper.tsx, src/lib/liveblocks.ts, src/trpc/server-context.ts
    - Removed top-of-file header comment lines only; no code, API, or behavior changes.
- Seed data & comments
  - src/lib/seed.ts
    - Removed header comment; changed first category name to "All categories"; simplified inline comment labels and adjusted one line of wording. No logic changes.
- Email API and usage
  - src/lib/sendEmail.ts, src/collections/Users.ts
    - Added required support_email: string to SendWelcomeOptions and included it in the Postmark template model; updated users collection afterChange to pass sender_name: 'Jay', add support_email (from env), and keep support_url. Call site email recipient remains static.
- UI styling
  - src/modules/home/ui/components/footer.tsx
    - Added Poppins font import and cn utility; applied Poppins className to footer text for typography styling only.
- Whitespace cleanup
  - src/modules/home/ui/components/search-filters/categories.tsx
    - Removed two blank lines around a hidden measurement block; no functional changes.

# Toggle password hidden

### Walkthrough

- Adds client-side password visibility toggles to SignInView and SignUpView (local showPassword state, toggle button, Eye/EyeOff icons, ARIA attributes, autoComplete tweaks). Also removes two blank lines in a home search-filters component; no functional change.

### New features

- Added a password visibility toggle to Sign In and Sign Up forms, preserving focus, updating accessible labels/pressed state, and switching between hidden and plain text without changing validation or submission. Inputs now include appropriate autocomplete hints (email, username, current/new password).
  Style

- Minor whitespace cleanup in UI code with no user-facing impact.

### File changes:

- Auth: Password visibility toggle
  - src/modules/auth/ui/views/sign-in-view.tsx, src/modules/auth/ui/views/sign-up-view.tsx
    - Introduce showPassword state, add a right-aligned toggle button that switches input type between password and text, render Eye/EyeOff icons, update aria-label/aria-pressed, add appropriate autoComplete attributes, preserve existing validation/submission logic.

- Home: Whitespace cleanup
  - src/modules/home/ui/components/search-filters/categories.tsx
    - Remove two extra blank lines around a hidden measurement block; whitespace-only change, no functional impact.

# Bug stripe verify 08/19/25

### Walkthrough

- Refactors Product create/update access to use a new mustBeStripeVerified check and adds a beforeChange hook enforcing tenant Stripe verification. Updates StripeVerify components to consider details_submitted. Adds emailVerified to Users and passes verification_url in welcome emails. Tweaks env-driven URLs, minor Tenants description cleanup, and adds Stripe webhook logging.

### New Features

- Added show/hide password toggle on sign-in and sign-up with accessible controls.
- Welcome emails now include a verification link; accounts track “Email Verified.”
- Improved seller verification banner messaging; creating/updating products now requires full Stripe verification.

### Bug Fixes

- Corrected CMS recap heading/tagging slug update notification.

### Documentation

- Added documentation for the password visibility toggle and minor cleanup notes for search filters.

### File changes:

- Docs recap
  - recap.md
    - Updated recap notes; added auth password-toggle doc; noted whitespace cleanup.

- Stripe webhook logging
  - src/app/(app)/api/stripe/webhooks/route.ts
    - Logged account.details_submitted in account.updated branch; no control-flow changes.
- Access control + Products enforcement
  - src/lib/access.ts, src/collections/Products.ts
    - Added mustBeStripeVerified Access; Products create/update now use it; new beforeChange hook loads tenant and enforces stripeAccountId + detailsSubmitted; delete remains super-admin only.
- User model + email flow
  - src/collections/Users.ts, src/lib/sendEmail.ts, src/payload-types.ts
    - Added Users.emailVerified field; welcome email now uses env-based URLs and includes verification_url; types updated to include emailVerified; removed support_email from payload.
- Stripe verification banner components
  - src/components/stripe-verify.tsx, src/components/custom-payload/stripe-verify.tsx
    - Verification now requires both stripeAccountId and detailsSubmitted; show inverted accordingly; removed default exports and dynamic flag; consolidated imports; message text updated.
- Tenants admin text
  - src/collections/Tenants.ts
    - Removed trailing space in admin.description; no functional changes.

# Feature email verification 08/19/25

### Walkthrough

- Adds Postmark-backed email transport to Payload, introduces a verification email flow using auth.verify, creates a Next.js /api/verify route to process tokens, updates Users collection to use verification templates, adjusts Product hooks to enforce tenant Stripe verification, updates user types for internal verification fields, and removes legacy code.

### New Features

- Email verification flow: users receive verification emails and can confirm via a new verification endpoint.
- Outgoing transactional emails enabled via Postmark, improving deliverability.
- Product creation and editing now require completed Stripe verification for the tenant, with clearer error messages when not verified.

- Outgoing transactional emails are enabled via Postmark.

### Changes

- Added Postmark transport dependency to support email delivery.

### Chores

- Added a dependency to support Postmark email transport.

### File changes:

- Email transport config & dependency
  - package.json, src/payload.config.ts
    - Adds nodemailer-postmark-transport dependency. Configures Payload email with Nodemailer + Postmark using POSTMARK_SERVER_TOKEN, default from name/address.
- Users verification flow
  - src/collections/Users.ts, src/lib/email/welcome-verify.ts
    - Replaces afterChange welcome email with auth.verify. Adds subject/HTML builders for verification emails. Removes emailVerified field and custom hook.
- Verification API route
  - src/app/api/verify/route.ts
    - New GET endpoint reads token, calls payload.verifyEmail for users, redirects to /sign-in with success/failure query. Exports runtime='nodejs'.
- Products tenant/Stripe checks
  - src/collections/Products.ts, src/lib/access.ts
    - Refactors beforeChange to fetch tenant via req.payload, require stripeAccountId and stripeDetailsSubmitted; casts req.user to User. Cleans legacy commented code. Tightens typing in mustBeStripeVerified.
- Types update
  - src/payload-types.ts
    - Moves public emailVerified to internal \_verified and \_verificationToken on User and UsersSelect.

# Feature small fixes 08/20/25

### Walkthrough

- Introduces an email verification workflow (Postmark transport, internal verification fields, and a /api/verify route), updates user types to internalize verification state, enforces tenant Stripe verification for product operations, disables post-signup auto-login, adjusts sign-up redirect and copy, and removes debug logs in Stripe webhook and checkout procedures.

### New Features

- Email verification added; users receive verification emails and can complete verification to activate accounts.
- “Forgot password?” link added to the sign-in screen.

### Refactor

- Streamlined verification flow and removed legacy paths to improve reliability.

### Behavior Changes

- After sign-up, users are redirected to the sign-in page.
- Product creation/edit now requires a verified Stripe account, with clearer error messages when not verified.
- Updated sign-up heading copy.

### Chores

- Added email service dependency and removed debug logs.

### File changes:

- Verification types and schema
  - src/payload-types.ts
    - Moves public emailVerified to internal fields (\_verified, \_verificationToken); updates UsersSelect accordingly.
- Auth server flow
  - src/modules/auth/server/procedures.ts
    - Disables post-registration auto-login and cookie set; login mutation unchanged.
- Auth UI
  - src/modules/auth/ui/views/sign-in-view.tsx, src/modules/auth/ui/views/sign-up-view.tsx
    - Adds “forgot password?” link on sign-in; changes sign-up heading text and redirects to /sign-in on success.
- Stripe verification access control
  - src/lib/access.ts
    - Wraps mustBeStripeVerified tenant fetch in try/catch; returns false on error; condition unchanged.
- Stripe webhook cleanup
  - src/app/(app)/api/stripe/webhooks/route.ts
    - Removes console.log from account.updated handler; logic unchanged.
- Checkout server cleanup
  - src/modules/checkout/server/procedures.ts
    - Removes a debug log before Stripe Checkout session creation; behavior unchanged.
- Feature recap
  - recap.md
    - Documents new Postmark email transport, verification workflow, API route, and type-level migrations.
