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
