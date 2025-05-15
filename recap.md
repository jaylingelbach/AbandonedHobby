# Categories finalization branch

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
