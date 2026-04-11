# Architecture

**Analysis Date:** 2025-05-15

## Pattern Overview

**Overall:** Client-Server Architecture (React + Supabase)

**Key Characteristics:**
- **Serverless Backend:** Leveraging Supabase for authentication, database (PostgreSQL), and edge functions.
- **Client-Side Rendering:** React with Vite for a fast and responsive user interface.
- **Row Level Security (RLS):** Security is enforced at the database layer using Supabase RLS policies.
- **Component-Based UI:** Using React components for modular and reusable UI elements.

## Layers

**Database Layer:**
- Purpose: Persistent storage and security enforcement.
- Location: `supabase/migrations/`
- Contains: Table definitions (`households`, `household_members`), RLS policies, and triggers.
- Depends on: Supabase Auth.
- Used by: Supabase Client Lib.

**Client Lib Layer:**
- Purpose: Interface for communicating with Supabase services.
- Location: `src/lib/supabase.ts`
- Contains: Supabase client initialization.
- Depends on: Supabase SDK.
- Used by: Auth Context, React Hooks/Components.

**Context Layer:**
- Purpose: Global state management for cross-cutting concerns.
- Location: `src/contexts/`
- Contains: `AuthContext.tsx`.
- Depends on: Supabase Client.
- Used by: Protected Routes, Components.

**Presentation Layer (Pages & Components):**
- Purpose: User interface and component-local logic.
- Location: `src/pages/`, `src/components/`
- Contains: React components, hooks, and styles.
- Depends on: Auth Context, Supabase Client.

## Data Flow

**Authentication Flow:**

1. User submits email via `src/pages/Auth/Login.tsx`.
2. `AuthContext.tsx` calls `supabase.auth.signInWithOtp`.
3. Supabase sends a Magic Link.
4. User clicks the link, and `AuthContext.tsx` updates the session state.

**Household & Member Management (Phase 2):**

1. **Automatic Household Creation:** A Supabase trigger in the database automatically creates a record in `public.households` when a new user signs up in `auth.users`.
2. **Fetching Members:** The `Household` page fetches members from `public.household_members` using the `supabase` client.
3. **Updating Members:** `ProfileForm` sends updates to `public.household_members` via the `supabase` client, which are authorized by RLS.

## Key Abstractions

**AuthContext:**
- Purpose: Provides authentication state and methods to the entire application.
- Examples: `src/contexts/AuthContext.tsx`
- Pattern: React Context API.

**Shell & Sidebar:**
- Purpose: Provides the core application layout and navigation.
- Examples: `src/components/Layout/Shell.tsx`, `src/components/Layout/Sidebar.tsx`.
- Pattern: Wrapper component / Layout pattern.

## Entry Points

**Main Entry Point:**
- Location: `src/main.tsx`
- Triggers: Browser page load.
- Responsibilities: Renders the `App` component into the DOM.

**App Root:**
- Location: `src/App.tsx`
- Triggers: Initial render.
- Responsibilities: Configures routing and provides the `AuthProvider`.

## Error Handling

**Strategy:** Centralized error reporting and local UI feedback.

**Patterns:**
- Try-catch blocks in async operations.
- UI feedback for auth errors in `Login.tsx`.

## Cross-Cutting Concerns

**Logging:** Currently using `console.log` for debugging.
**Validation:** Form-level validation in `Login.tsx`.
**Authentication:** Managed via `AuthContext.tsx` and protected routes in `App.tsx`.

---

*Architecture analysis: 2025-05-15*
