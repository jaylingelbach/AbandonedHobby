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
  -Added global toast notifications for feedback on authentication actions.

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
