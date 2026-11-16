# INNOVEDGE Assessor Platform — Security Baseline & Threat Model

## 1. Security Architecture & Threat Model

The INNOVEDGE Assessor Platform is a high-stakes competition evaluation platform. The primary security objectives are:
1. **Confidentiality**: Rubric breakdowns, AI evaluation prompts, proprietary challenge data, and unapproved scores must remain accessible only to the authorized administrator.
2. **Integrity**: Scorecards, final qualification decisions, leaderboard rankings, and plagiarism deductions must be immune to tampering, client-side forgery, or unauthorized elevation.
3. **Availability**: The evaluation queue and server endpoints must be resilient against Denial-of-Service, API token exhaustion, and runaway concurrency.

---

## 2. Authentication & Authorization Boundaries

```mermaid
flowchart TD
    User([Incoming User Request]) --> RouteGuard{Client Route Guard beforeLoad}
    RouteGuard -->|No Valid Session| AuthPage[/auth - Admin Sign-In]
    RouteGuard -->|Valid Supabase Session| Shell[Authenticated Layout]
    
    Shell --> ServerCall[Server Function Invocation]
    ServerCall --> TokenAttach[attachSupabaseAuth: Bearer JWT]
    TokenAttach --> AuthMiddleware[requireSupabaseAuth: Verify JWT Claims]
    
    AuthMiddleware -->|Invalid/Missing Token| Reject401[HTTP 401 Unauthorized]
    AuthMiddleware -->|Valid Token| DBQuery[PostgreSQL PostgREST Client]
    
    DBQuery --> RLS{PostgreSQL Row Level Security}
    RLS -->|public.is_admin auth.uid = true| PermitDB[Database Mutation / Read]
    RLS -->|public.is_admin = false| DenyDB[PostgreSQL 42501 Permission Denied]
```

### 2.1 Identity & Access Boundary
- **Designated Administrator Identity**: `TeamInoSap26@gmail.com`.
- **Database Identity Check (`public.is_admin`)**:
  ```sql
  SELECT EXISTS(
    SELECT 1 FROM public.admin_users a
    JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id = _uid
      AND lower(u.email) = 'teaminosap26@gmail.com'
      AND u.email_confirmed_at IS NOT NULL
  );
  ```
  This check guarantees that even if another user registers or acquires a JWT in Supabase Auth, they cannot execute queries or mutations on any protected table.

### 2.2 Server Function Authorization
- All server functions (`evaluateJob`, `checkAiStatus`, `testAiConnection` in `src/lib/evaluate.functions.ts`) enforce server-side authentication using the `requireSupabaseAuth` middleware.
- The middleware parses the incoming `Authorization: Bearer <token>` header, verifies the JWT claims with Supabase, extracts the user `sub`, and attaches an authenticated client instance to the execution context.
- Unauthenticated requests are rejected immediately with an HTTP 401 error.

---

## 3. Database Security & Row Level Security (RLS)

### 3.1 Policy Enforcement Matrix

| Table | Policy Name | Permitted Roles | Policy Condition (`USING` / `WITH CHECK`) |
| :--- | :--- | :--- | :--- |
| `admin_users` | `admins read admins` | `authenticated` | `public.is_admin(auth.uid())` |
| `teams` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `team_members` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `evaluation_components` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `evaluation_criteria` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `evaluation_templates` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `evaluations` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `criterion_scores` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `admin_score_overrides` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `evaluation_jobs` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `evaluation_history` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `activity_logs` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `api_usage_logs` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |
| `system_settings` | `admin all` | `authenticated` | `public.is_admin(auth.uid())` |

### 3.2 Storage Security
- Bucket: `project-pdfs`
- Storage policies on `storage.objects`:
  - `admin pdf read`: `bucket_id = 'project-pdfs' AND public.is_admin(auth.uid())`
  - `admin pdf write`: `bucket_id = 'project-pdfs' AND public.is_admin(auth.uid())`
  - `admin pdf update`: `bucket_id = 'project-pdfs' AND public.is_admin(auth.uid())`
  - `admin pdf delete`: `bucket_id = 'project-pdfs' AND public.is_admin(auth.uid())`
- Database Trigger Check: The `require_project_pdf` trigger checks that the referenced `pdf_path` exists in `storage.objects` and is no larger than 3,145,728 bytes (3 MB).

---

## 4. Secrets Management & Sanitization

1. **Server-Side API Keys**:
   - `GEMINI_API_KEY`: Server-side only. Used in `evaluate.functions.ts` to call Gemini API.
   - `SUPABASE_SERVICE_ROLE_KEY`: Server-side only. Used in `client.server.ts`.
   - `NEXUS_API_KEY`: Server-side only fallback gateway key.
   - `GITHUB_TOKEN`: Server-side only. Used in `evidence.server.ts` to elevate GitHub API rate limits.
2. **Client-Exposed Keys**:
   - `VITE_SUPABASE_URL` / `SUPABASE_URL`: Public Supabase API URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`: Public anon/publishable key.
3. **Redaction Standard**: Secret values must never be output to client console logs, API error payloads, client bundles, or documentation files.

---

## 5. Input Validation & Defense-in-Depth

- **Client & Server Schema Validation**: `submissionSchema` in `src/lib/submission.ts` enforces:
  - Team Name: 1-100 characters.
  - Team Email: valid email format, max 255 characters.
  - Project Title: 1-200 characters.
  - Project Description: 1-10,000 characters.
  - GitHub URL: strictly matching `^https:\/\/(www\.)?github\.com\/[^/]+\/[^/?#]+\/?(?:[?#].*)?$`
  - Website URL: valid `http://` or `https://` protocol.
- **PDF File Safety**:
  - Magic byte verification: `checkPdf(file)` verifies `%PDF-` file header signature.
  - Size enforcement: Strictly capped at 3 MB across client validator, database check constraint, and database trigger.
- **CSRF Protection**: `createCsrfMiddleware` is enabled in `src/start.ts` for all server function RPCs.

---

## 6. Audit Logging & Non-Repudiation

- **Activity Trail**: Every administrative action (team creation, edits, deletions, criteria updates, queue start/pause) writes to `public.activity_logs`.
- **Score Override Trail**: Manual score modifications write previous and new values to `public.admin_score_overrides` with mandatory text reasons and editor ID.
- **Evaluation History**: Detailed re-evaluation and status transition payloads are recorded in `public.evaluation_history`.

---

## 7. Known Security Vulnerabilities & Remediation Roadmap

The following vulnerabilities were discovered during the mandatory security audit. **Per the master protocol, these are documented with proposed remediation plans for explicit user approval before execution.**

### VULN-01: Development Authentication Bypass in Production (`auth.tsx`)
- **Severity**: **CRITICAL**
- **Location**: `src/routes/auth.tsx` (Lines 57-63)
- **Vulnerability**:
  ```ts
  if (password === "admin" || password === "admin123" || isLocalDev) {
    localStorage.setItem("dev_admin_auth", JSON.stringify({ email: "TeamInoSap26@gmail.com", id: "dev-admin-id" }));
    setBusy(false);
    toast.success("Signed in as authorized evaluation administrator");
    navigate({ to: "/dashboard" });
    return;
  }
  ```
  In any environment (including production), entering email `TeamInoSap26@gmail.com` with password `"admin"` or `"admin123"` sets the admin mock session in `localStorage` and admits the user into the client application.
- **Remediation Plan**:
  Remove the password check fallback entirely. In production (`!import.meta.env.DEV`), authentication must exclusively succeed via `supabase.auth.signInWithPassword`. Even in development, isolate bypasses to an explicit opt-in environment flag (`VITE_ALLOW_DEV_BYPASS=true`).

### VULN-02: Universal Mock Fallback in Authenticated Route Guard (`_authenticated/route.tsx`)
- **Severity**: **CRITICAL**
- **Location**: `src/routes/_authenticated/route.tsx` (Lines 39-40, 80-87)
- **Vulnerability**:
  ```ts
  // beforeLoad
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) return { user: data.user };
  } catch {}

  const adminUser = { email: "TeamInoSap26@gmail.com", id: "dev-admin-id" };
  return { user: adminUser };
  ```
  When an unauthenticated visitor accesses any `/_authenticated/*` route directly in a browser, `getUser()` returns null/error. The code falls through and assigns the mock admin identity, granting full frontend UI access. Additionally, the `is-admin` query catches RPC errors and returns `true`.
- **Remediation Plan**:
  Replace fall-through with an explicit redirect to `/auth`:
  ```ts
  if (!user || !isAllowedAccount(user.email ?? "")) {
    throw redirect({ to: "/auth", search: { redirect: location.href } });
  }
  ```

### VULN-03: Service Role Key Fallback to Publishable Key (`client.server.ts`)
- **Severity**: **HIGH**
- **Location**: `src/integrations/supabase/client.server.ts` (Lines 36-37)
- **Vulnerability**:
  ```ts
  const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] 
    || process.env['SUPABASE_PUBLISHABLE_KEY'] 
    || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] 
    || DEFAULT_KEY;
  ```
  If `SUPABASE_SERVICE_ROLE_KEY` is not configured, the server client silently uses the publishable key. A client with publishable credentials cannot bypass RLS, leading to silent authorization failures or unexpected permissions.
- **Remediation Plan**:
  Throw an explicit server configuration exception if `SUPABASE_SERVICE_ROLE_KEY` is missing rather than substituting publishable credentials.

### VULN-04: Hardcoded Default Credentials in Source Files
- **Severity**: **MEDIUM**
- **Location**: `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`
- **Vulnerability**:
  Default Supabase project URL and publishable key are hardcoded as fallback string constants in source code.
- **Remediation Plan**:
  Require environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` without committing live project IDs and keys into repository source files.
