# AGENTS.md — INNOVEDGE Assessor Platform Development Protocol

## 1. Project Identity & Purpose
- **Project**: INNOVEDGE Assessor Platform
- **Repository**: `saptha-hacks-main` (`saptha-hacks-dashboard`)
- **Domain**: Official AI-powered hackathon project evaluation, originality verification, team qualification, and certified scorecard generation system.
- **Designated Administrator**: `TeamInoSap26@gmail.com` (strictly enforced at database RLS and server middleware).

---

## 2. Technology Foundation & Stack Constraints
The application is built on an integrated modern TypeScript stack. Do not replace, wrap, or deprecate these foundational technologies without explicit architectural justification and user approval:

| Layer | Technology | Primary Package / Version |
| :--- | :--- | :--- |
| **Framework & SSR** | TanStack Start (Nitro runtime) | `@tanstack/react-start` `1.168.60` |
| **Routing** | TanStack Router (File-based) | `@tanstack/react-router` `1.170.41` |
| **UI Library** | React 19 + Radix UI Primitives | `react` `^19.2.0`, `@radix-ui/*` |
| **Styling** | Tailwind CSS v4 + tw-animate-css | `tailwindcss` `^4.2.1`, `@tailwindcss/vite` |
| **Data Fetching** | TanStack Query v5 | `@tanstack/react-query` `^5.101.1` |
| **Database & Auth** | Supabase PostgreSQL + Auth + Storage | `@supabase/supabase-js` `^2.119.0` |
| **Database Tooling** | Drizzle Kit & Migration Tooling | `drizzle-kit` `0.x`, `drizzle-orm` `0.x` |
| **AI Evaluation** | Google Gemini API / Nexus Gateway | Direct REST / streaming `gemini-3.1-flash-lite` |
| **Validation** | Zod v3 | `zod` `^3.25.76` |
| **Document Engine** | PDF.js + SheetJS | `pdfjs-dist` `^6.5.438`, `xlsx` `^0.18.5` |
| **Visuals & Charts** | Framer Motion + Recharts | `framer-motion` `^14.10.1`, `recharts` `^2.15.4` |
| **Testing** | Vitest + Testing Library + jsdom | `vitest` `^4.1.10`, `@testing-library/react` |

---

## 3. Directory Structure & Responsibilities

```
saptha-hacks-main/
├── .nexus/                     # Project metadata and configuration
├── drizzle/                    # Database schema definitions and SQL migrations
│   ├── migrations/             # Sequential migration files (0000, 0001, ...)
│   └── schema.ts               # Drizzle schema export
├── public/                     # Static assets (logos, favicons, robots.txt)
├── src/
│   ├── components/             # Reusable domain components
│   │   ├── ui/                 # Atomic UI primitives (Radix UI wrappers)
│   │   ├── team-form.tsx       # Team creation / edit form
│   │   ├── team-report-card.tsx# Certified 1-page printable scorecard
│   │   ├── eval-card.tsx       # Component evaluation card
│   │   ├── delete-team-modal.tsx # Confirmed deletion modal
│   │   ├── edit-score-modal.tsx  # Manual score override modal
│   │   └── score-breakdown-modal.tsx # Detailed rubric score dialog
│   ├── hooks/                  # Custom React hooks (e.g., use-mobile)
│   ├── integrations/supabase/  # Supabase clients, middleware, and generated types
│   │   ├── auth-attacher.ts    # Client-side Bearer token attacher for server functions
│   │   ├── auth-middleware.ts  # Server-side Supabase JWT verification middleware
│   │   ├── client.ts           # Browser Supabase client (persists session)
│   │   ├── client.server.ts    # Server-side admin client (service-role key)
│   │   ├── cron-auth.ts        # Cron request signature verification
│   │   └── types.ts            # Supabase auto-generated database schema types
│   ├── lib/                    # Core business logic, scoring, and utilities
│   │   ├── db.ts               # Database helpers, fetchAll, enqueue, activity logging
│   │   ├── error-capture.ts    # SSR error boundary capture logic
│   │   ├── error-page.ts       # Catastrophic SSR error HTML fallback
│   │   ├── evaluate.functions.ts # TanStack Start server functions (callAI, evaluateJob)
│   │   ├── evaluation-engine.ts# Evaluation orchestrator
│   │   ├── evidence.server.ts  # Server-side GitHub API and Website evidence extractors
│   │   ├── export.ts           # CSV/XLSX export and import parser utilities
│   │   ├── pdf.ts              # Browser-side PDF.js text extractor
│   │   ├── plagiarism.ts       # Jaccard similarity scanner & duplicate repo detector
│   │   ├── problem-statements.ts # Problem statement management & template bridge
│   │   ├── queries.ts          # TanStack Query query functions & cache definitions
│   │   ├── queue-runner.tsx    # Evaluation queue context provider & rate-limiting loop
│   │   ├── scoring.ts          # Core 30/40/30 weighting, ranking, and overrides
│   │   ├── submission.ts       # Input validation schemas and PDF constraints
│   │   ├── team-store.ts       # Persistent local team cache
│   │   ├── usage-logger.ts     # Token pricing calculator & API usage logger
│   │   └── utils.ts            # ClassName merging and Tailwind helpers
│   ├── routes/                 # File-based TanStack Router routes
│   │   ├── __root.tsx          # Root layout, theme injection, Toaster, ErrorComponent
│   │   ├── index.tsx           # Entry redirect -> /dashboard
│   │   ├── auth.tsx            # Administrator login and password reset request
│   │   ├── reset-password.tsx  # Password reset completion
│   │   └── _authenticated/     # Authenticated shell layout and admin pages
│   │       ├── route.tsx       # Auth layout guard & navigation drawer
│   │       ├── dashboard.tsx   # Main evaluation dashboard
│   │       ├── teams.index.tsx # Teams list and filtering
│   │       ├── teams.new.tsx   # Add new team
│   │       ├── teams.$id.index.tsx # Team evaluation inspection
│   │       ├── teams.$id.edit.tsx  # Edit team details
│   │       ├── import.tsx      # Bulk CSV/Excel team & PDF import
│   │       ├── criteria.tsx    # Evaluation rubric criteria configuration
│   │       ├── queue.tsx       # Evaluation queue execution & monitoring
│   │       ├── evaluations.tsx # Consolidated scores & manual review
│   │       ├── leaderboard.tsx # Official competitive ranking & exports
│   │       ├── qualification.tsx # Shortlisting & qualification decisions
│   │       ├── plagiarism.tsx  # Originality scan & duplicate detection
│   │       ├── problem-statements.tsx # Hackathon challenge management
│   │       ├── reports.tsx     # Bulk scorecard & qualified export reports
│   │       ├── settings.tsx    # System settings, weights, model selection
│   │       ├── usage.tsx       # AI API token analytics & cost calculations
│   │       └── activity.tsx    # Security and audit activity trail
│   ├── test/                   # Vitest setup and router integration tests
│   ├── router.tsx              # Router initialization & QueryClient factory
│   ├── routeTree.gen.ts        # Auto-generated TanStack Router tree (DO NOT EDIT)
│   ├── server.ts               # SSR entry point and catastrophic error wrapper
│   ├── start.ts                # TanStack Start server configuration & middleware
│   └── styles.css              # Global styles, Tailwind v4 theme, fonts
└── docs/                       # Permanent architecture and operational knowledge base
```

---

## 4. Architectural Conventions & Rules

### 4.1 Routing & Layout Conventions
1. All protected administrative routes must live under `src/routes/_authenticated/`.
2. Do not manually edit `src/routeTree.gen.ts`. It is compiled automatically by TanStack Router plugin during `vite dev` and `vite build`.
3. Every route definition must declare appropriate `head` metadata and type-safe params.
4. Route loaders and `beforeLoad` functions must not leak unvalidated admin state.

### 4.2 Server Functions & API Boundaries
1. Server functions must be declared with `createServerFn({ method: "POST" | "GET" })` from `@tanstack/react-start`.
2. All privileged server functions performing administrative actions, AI calls, or database mutations must include `.middleware([requireSupabaseAuth])`.
3. Secrets (`GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`) must never be imported into client components or client bundles. Keep them exclusively in `.server.ts` modules or inside `createServerFn` server handlers.
4. Client requests must attach the Supabase session JWT via `attachSupabaseAuth` middleware in `src/start.ts`.

### 4.3 Database, Migrations & RLS Conventions
1. Every new database table must have Row Level Security enabled: `ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;`.
2. All privileged tables must restrict administrative access to `public.is_admin(auth.uid())`.
3. `is_admin(_uid uuid)` verifies that `auth.users` has `email = 'TeamInoSap26@gmail.com'` and `email_confirmed_at IS NOT NULL`.
4. Migrations must be sequential, forward-only SQL files in `drizzle/migrations/`. Never alter or renumber existing migrations.
5. Foreign keys referencing `public.teams(id)` must include `ON DELETE CASCADE`.

### 4.4 Data Integrity & Mutation Rules
1. **Never swallow database errors**: If a Supabase mutation returns an error, the operation has failed. Do not show a success toast, do not pretend it succeeded, and do not treat `localStorage` as authoritative persistence.
2. In-flight evaluations must use atomic locks: `evaluation_jobs` status transitions (`queued` -> `processing` -> `done` / `failed`) must check previous state atomically to prevent duplicate runs.
3. Every manual score override must be audited in `admin_score_overrides` and logged in `evaluation_history` and `activity_logs`.

### 4.5 AI Evaluation Pipeline
1. Model: `gemini-3.1-flash-lite` (via direct Google Gemini endpoint or fallback Nexus AI Gateway).
2. All AI outputs must be validated using strict JSON schema with criterion-by-criterion explanation and evidence quotes.
3. Scoring bounds: Scores must be strictly between `0` and `max_marks`. Any score with low confidence (< 0.5) or insufficient evidence must be flagged with `needs_review = true`.
4. Real token usage and latency must be recorded in `api_usage_logs` on every execution.

### 4.6 UI/UX & Styling Standards
1. Use the established design system: clean glassmorphism cards (`glass`, `bg-card/95`), subtle borders (`border-border/60`), Sora and Manrope typography, and dynamic dark/light mode support.
2. Maintain responsive layouts: tables must support horizontal scrolling (`overflow-x-auto`) on mobile viewports.
3. Interactive buttons performing mutations or AI calls must provide clear loading spinners (`Loader2 className="animate-spin"`) and disabled states while active.
4. Do not introduce generic AI dashboard gradients, flashy animations, or unrequested UI themes.

---

## 5. Prohibited Practices (Never Do)
- **NEVER** introduce client-side authentication bypasses or mock admin identities in production code.
- **NEVER** treat `localStorage` as authoritative database persistence when Supabase operations fail.
- **NEVER** use mock score generators or hardcoded heuristic formulas in place of genuine Gemini AI evaluation.
- **NEVER** silently fall back from `SUPABASE_SERVICE_ROLE_KEY` to publishable keys while claiming admin privileges.
- **NEVER** expose API keys or service role credentials in client bundles or public endpoints.
- **NEVER** execute student code directly during GitHub or website evidence collection (only inspect static files and public pages).
- **NEVER** run destructive database migrations (e.g. dropping tables or columns) without explicit user authorization.

---

## 6. Standard Future Feature Workflow
Every feature request must proceed through the protocol detailed in [FEATURE_IMPLEMENTATION_PLAYBOOK.md](file:///c:/Users/Ananya/sapthahacks/docs/FEATURE_IMPLEMENTATION_PLAYBOOK.md):
1. **Discovery & Module Placement**: Locate existing implementations and shared utilities before creating new files.
2. **Impact & Boundary Analysis**: Assess frontend, server function, database schema, and security boundaries.
3. **Implementation**: Build type-safe, validated, and genuinely integrated features.
4. **Verification**: Run `pnpm test`, `pnpm build`, and lint checks to ensure zero regressions.
5. **Engineering Completion Report**: Document changes, security, testing status, and remaining prerequisites.
