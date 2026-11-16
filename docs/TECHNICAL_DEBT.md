# INNOVEDGE Assessor Platform — Technical Debt Ledger

## 1. Overview
This document tracks all identified architectural, technical, and implementation debt in the INNOVEDGE Assessor Platform. Each entry details the affected files, business impact, recommended solution, and verification criteria.

No debt item may be marked as `Resolved` without automated test and runtime verification.

---

## 2. Debt Ledger

### DEBT-01: Disconnected Mock Evaluator vs. Real Gemini AI Server Function
- **Identifier**: `DEBT-01`
- **Severity**: **HIGH**
- **Affected Files**:
  - `src/lib/evaluation-engine.ts`
  - `src/lib/evaluate.functions.ts`
  - `src/routes/_authenticated/queue.tsx`
  - `src/routes/_authenticated/dashboard.tsx`
  - `src/routes/_authenticated/teams.index.tsx`
  - `src/routes/_authenticated/teams.$id.index.tsx`
- **Description**:
  The application contains two conflicting evaluation implementations:
  1. `src/lib/evaluate.functions.ts`: Genuine TanStack Start server function (`evaluateJob`) calling Gemini 3.1 Flash Lite API with schema validation, streaming JSON parsing, and real token logging.
  2. `src/lib/evaluation-engine.ts`: Client-side function (`evaluateSingleTeam` / `runDirectEvaluation`) that generates artificial scores using string formulas (e.g., `score = 82 + ((team.name.length * 3) % 13)`) and logs fake token usage numbers (`1250 + Math.random() * 600`).
  Currently, several UI buttons (such as "Evaluate" in `dashboard.tsx` and "Run Evaluation" in `queue.tsx`) invoke the client-side mock rather than enqueueing jobs for the real Gemini engine.
- **Business Impact**:
  Evaluations triggered from dashboard or queue may assign hardcoded heuristic marks rather than authentic multi-modal AI assessments, compromising competition grading validity.
- **Recommended Solution**:
  Deprecate the client-side heuristic score generator. Refactor manual evaluation triggers to call the Supabase `enqueue` function or invoke `evaluateJob` directly through the authenticated server function pipeline.
- **Dependencies**: Valid `GEMINI_API_KEY` configured in environment.
- **Current Status**: **Open**

---

### DEBT-02: Silent Mutation Failure & False Positive User Feedback
- **Identifier**: `DEBT-02`
- **Severity**: **HIGH**
- **Affected Files**:
  - `src/components/team-form.tsx`
  - `src/components/delete-team-modal.tsx`
  - `src/components/edit-score-modal.tsx`
  - `src/routes/_authenticated/teams.$id.index.tsx`
- **Description**:
  When a Supabase mutation (`insert`, `update`, `delete`) fails (due to RLS rejection, missing session, network failure, or foreign key violation), the catch block swallows the error with `console.warn(...)`, saves the record locally to `localStorage`, and displays `toast.success("Team added")` or `toast.success("Saved")`.
- **Business Impact**:
  Users believe records are securely saved to the cloud database when they may exist only temporarily in local browser storage. If the user changes devices or clears cache, data is silently lost.
- **Recommended Solution**:
  Propagate Supabase mutation errors. Only display success notifications and navigate when the database transaction actually succeeds:
  ```ts
  const { data, error } = await supabase.from("teams").insert(...);
  if (error) {
    toast.error(`Database error: ${error.message}`);
    return;
  }
  toast.success("Team added");
  ```
- **Dependencies**: Active Supabase database connection and authenticated session.
- **Current Status**: **Open**

---

### DEBT-03: Dual State Persistence Duality (localStorage vs. Supabase)
- **Identifier**: `DEBT-03`
- **Severity**: **MEDIUM**
- **Affected Files**:
  - `src/lib/team-store.ts`
  - `src/lib/queries.ts`
  - `src/lib/problem-statements.ts`
  - `src/lib/usage-logger.ts`
  - `src/lib/plagiarism.ts`
- **Description**:
  The application maintains parallel storage keys in browser `localStorage` (`innovedge_persistent_teams_vault`, `assessor_problem_statements`, `innovedge_recorded_api_logs_vault`, `innovedge_plagiarism_admin_decisions_v2`). When Supabase returns zero rows or encounters an error, queries seamlessly fall back to local storage.
- **Business Impact**:
  Creates state desynchronization between different administrator devices, browsers, and backend reporting tools.
- **Recommended Solution**:
  Establish Supabase PostgreSQL as the sole source of authoritative state. Retain local storage only as an offline read-cache if necessary, but never allow mutations to write to local storage without successful remote synchronization.
- **Dependencies**: Supabase connectivity.
- **Current Status**: **Open**

---

### DEBT-04: Problem Statements Stored in evaluation_templates JSONB Column
- **Identifier**: `DEBT-04`
- **Severity**: **MEDIUM**
- **Affected Files**:
  - `src/lib/problem-statements.ts`
  - `drizzle/migrations/0000_migration.sql`
- **Description**:
  Problem statements are currently multiplexed into the `public.evaluation_templates` table by setting `component = 'problem_statement'` and embedding problem statement attributes (`code`, `category`, `requirements`) inside the `criteria` JSONB column.
- **Business Impact**:
  Prevents relational foreign keys from `public.teams` to problem statements, preventing relational integrity, cascade protections, and efficient relational indexing.
- **Recommended Solution**:
  Create a dedicated forward migration establishing `public.problem_statements (id uuid primary key, code text unique, title text, category text, description text, requirements text, created_at timestamptz)` and add an optional foreign key `problem_statement_id` on `public.teams`.
- **Dependencies**: Database migration approval.
- **Current Status**: **Open**

---

### DEBT-05: Queue UI Execution Model Disconnect
- **Identifier**: `DEBT-05`
- **Severity**: **MEDIUM**
- **Affected Files**:
  - `src/routes/_authenticated/queue.tsx`
  - `src/lib/queue-runner.tsx`
- **Description**:
  In `src/routes/_authenticated/queue.tsx`, the `startFor` handler iterates over `getPersistentTeams()` and invokes `runDirectEvaluation` synchronously in the browser, rather than invoking `enqueue` to insert rows into `evaluation_jobs` and starting the background `QueueRunnerProvider` loop.
- **Business Impact**:
  Bypasses the concurrency control, rate limiting, and daily token cap safeguards implemented in `queue-runner.tsx`.
- **Recommended Solution**:
  Refactor `startFor` to call `enqueue(teamIds, comps)` and `runner.start()`.
- **Dependencies**: DEBT-01 resolution.
- **Current Status**: **Open**

---

### DEBT-06: Strict TypeScript Type Discrepancies
- **Identifier**: `DEBT-06`
- **Severity**: **LOW**
- **Affected Files**:
  - `src/routes/_authenticated/usage.tsx`
  - `src/routes/_authenticated/settings.tsx`
  - `src/routes/_authenticated/evaluations.tsx`
  - `src/components/animated-background.tsx`
  - `src/components/collaboration-hero.tsx`
  - `src/components/team-form.tsx`
- **Description**:
  Running `pnpm exec tsc --noEmit` reveals ~60 type mismatches under strict compiler options (`exactOptionalPropertyTypes: true`, `noPropertyAccessFromIndexSignature: true`). For instance, index signature lookups (`map.pdf` vs `map['pdf']`) and passing optional properties with explicit `undefined`.
- **Business Impact**:
  Does not block the Vite bundle build (which transpiles via Rolldown/ESBuild), but prevents clean continuous integration type checks.
- **Recommended Solution**:
  Update index signature accesses to bracket notation (`map['pdf']`) and resolve exact optional property types.
- **Dependencies**: None.
- **Current Status**: **Open**

---

### DEBT-07: Code Formatting & Linter Discrepancies
- **Identifier**: `DEBT-07`
- **Severity**: **LOW**
- **Affected Files**: Repository-wide
- **Description**:
  `pnpm lint` reports 1610 problems (1586 formatting errors via `eslint-plugin-prettier` and 24 empty block warnings).
- **Business Impact**:
  Linter failure in CI pipelines.
- **Recommended Solution**:
  Run `pnpm format` (`prettier --write .`) and resolve empty catch blocks with descriptive comments or explicit error logs.
- **Dependencies**: None.
- **Current Status**: **Open**

---

### DEBT-08: Deprecated TanStack Start Server Function Validator API
- **Identifier**: `DEBT-08`
- **Severity**: **LOW**
- **Affected Files**:
  - `src/lib/evaluate.functions.ts` (Line 194)
- **Description**:
  Vite build outputs deprecation warning: `createServerFn().inputValidator() is deprecated. Use createServerFn().validator() instead.`
- **Business Impact**:
  Future framework upgrade breakage.
- **Recommended Solution**:
  Replace `.inputValidator(...)` with `.validator(...)`.
- **Dependencies**: None.
- **Current Status**: **Open**
