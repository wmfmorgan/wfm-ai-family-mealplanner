# Codebase Structure

**Analysis Date:** 2025-05-15

## Directory Layout

```
[project-root]/
├── .planning/       # Project planning and research
├── .stitch/         # Stitch configuration and design documents
├── node_modules/    # Dependencies
├── public/          # Public assets
├── src/
│   ├── __tests__/   # Global test files
│   ├── components/  # Reusable React components
│   │   ├── Auth/    # Auth related components
│   │   ├── Layout/  # Shell, Sidebar, Navigation
│   │   └── Household/ # (Planned) Member management components
│   ├── contexts/    # Context providers
│   ├── lib/         # Shared library configurations (Supabase)
│   ├── pages/       # Page-level components
│   │   ├── Auth/    # Auth pages
│   │   └── Household/ # (Planned) Household and profile management
│   ├── styles/      # Global styles and theme
│   ├── App.tsx      # Main application routing
│   └── main.tsx     # Application entry point
├── supabase/
│   ├── functions/   # Supabase Edge Functions
│   └── migrations/  # Database migrations
├── index.html       # HTML entry point
├── package.json     # Node.js dependencies and scripts
├── tsconfig.json    # TypeScript configuration
└── vite.config.ts   # Vite configuration
```

## Directory Purposes

**src/components:**
- Purpose: Modular and reusable React components.
- Contains: Component logic and associated styles.
- Key files: `src/components/Layout/Shell.tsx`, `src/components/Layout/Sidebar.tsx`.

**src/pages:**
- Purpose: Components that represent entire pages or routes.
- Contains: Logic for specific application views.
- Key files: `src/pages/Auth/Login.tsx`.

**src/contexts:**
- Purpose: React Context providers for global state.
- Contains: Authentication state and other cross-cutting concerns.
- Key files: `src/contexts/AuthContext.tsx`.

**src/lib:**
- Purpose: External library initialization and helpers.
- Contains: Supabase client setup.
- Key files: `src/lib/supabase.ts`.

**supabase/migrations:**
- Purpose: PostgreSQL schema definitions and database-level logic.
- Contains: Table definitions, RLS policies, and triggers.
- Key files: `supabase/migrations/20260411000000_initial_schema.sql`.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Renders the React application into the DOM.
- `src/App.tsx`: Defines the application's routing and root provider structure.

**Configuration:**
- `vite.config.ts`: Vite build and development server settings.
- `tsconfig.json`: TypeScript compiler options.
- `package.json`: Project dependencies and metadata.

**Core Logic:**
- `src/contexts/AuthContext.tsx`: Manages authentication state.
- `src/lib/supabase.ts`: Provides the Supabase client instance.

**Testing:**
- `src/__tests__/`: Root directory for tests.

## Naming Conventions

**Files:**
- PascalCase for React components: `Login.tsx`, `Sidebar.tsx`.
- camelCase for logic files: `supabase.ts`, `setup.ts`.
- kebab-case for style files (if not co-located): `theme.css`.

**Directories:**
- PascalCase for component and page folders: `Auth/`, `Layout/`.
- camelCase for utility folders: `lib/`, `contexts/`.

## Where to Add New Code

**New Feature (Phase 2):**
- Primary code for Household: `src/pages/Household/Household.tsx`.
- Member management components: `src/components/Household/MemberCard.tsx`, `src/components/Household/MemberGrid.tsx`, `src/components/Household/ProfileForm.tsx`.
- Tests: `src/__tests__/household.test.tsx` (suggested).

**New Component/Module:**
- Implementation: `src/components/[Feature]/[Component].tsx`.

**Utilities:**
- Shared helpers: `src/lib/`.

## Special Directories

**supabase/migrations:**
- Purpose: Database schema version control.
- Generated: No (manually managed).
- Committed: Yes.

---

*Structure analysis: 2025-05-15*
