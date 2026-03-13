# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Akkountant-V2 is a React-based financial management application that handles transactions, investments, and job management. The frontend is built with Vite, TypeScript, React Router, and Material-UI components with SCSS modules for styling.

## Development Commands

- **Start development server**: `npm run dev`
- **Build for production**: `npm run build` (runs TypeScript compilation then Vite build)
- **Lint code**: `npm run lint`
- **Preview production build**: `npm run preview`

Note: No test scripts are currently configured in package.json.

## Architecture Overview

### Core Application Structure

The app uses a multi-provider architecture with nested context providers in main.tsx:
- MessageProvider (notifications)
- LoadingProvider (global loading state)
- AuthProvider (Firebase authentication)
- UserProvider (user data and bank selections)
- FilterProvider (transaction filters)
- FileFilterProvider (file-based filters)
- MSNProvider (investment data)

### Routing & Authentication

- Uses React Router with private routes via PrivateRoute component
- Firebase authentication integration with automatic token handling
- Main routes: `/login`, `/home`, `/transactions`, `/investments`, `/jobs`

### HTTP Client Configuration

Axios is configured with caching via `axios-cache-interceptor` and automatic Firebase UID header injection for authenticated requests. The base URL is set to `/api/` expecting a proxy configuration.

### Key Contexts and State Management

- **AuthContext**: Firebase user authentication state
- **GlobalContext**: User data, opted banks, transaction mode selection
- **FilterContext**: Transaction and date filtering
- **FileFilterContext**: File-based operations filtering
- **LoadingContext**: Global loading state management
- **MSNContext**: Investment and mutual fund data
- **MessageContext**: Toast notifications and messages

### Component Organization

Components are organized by feature with co-located SCSS modules:
- Page components in `src/pages/` (Home, Transactions, Investments, Jobs)
- Reusable components in `src/components/` with feature-specific subdirectories
- Each component folder typically includes `.tsx` and `.module.scss` files

### Services Layer

Located in `src/services/`:
- `AxiosConfig.tsx`: HTTP client setup with caching and auth
- `transactionService.ts`: Transaction-related API calls
- `investmentService.ts`: Investment and MSN data
- `jobService.ts`: Background job management

### Data Types

Comprehensive TypeScript interfaces are defined in `src/utils/interfaces.ts` covering:
- Transaction and file management types
- Investment and MSN data structures
- API request/response schemas
- Filter and pagination interfaces

## Development Notes

- Uses Vite with special handling for `.js` files to be treated as JSX
- SCSS modules for component-specific styling
- Firebase for authentication with automatic token refresh
- Material-UI components throughout the application
- Lodash for utility functions
- Date manipulation with date-fns and dayjs libraries