import type { TeamRow, Team, Evaluation } from "./queries";
import { COMPONENTS, type Weights } from "./scoring";

const STORAGE_KEY = "innovedge_persistent_teams_vault";
const MEMBERS_STORAGE_KEY = "innovedge_persistent_team_members";

export const DEFAULT_WEIGHTS: Weights = {
  pdf: 30,
  github: 40,
  website: 30,
};

export const INITIAL_TEAMS: TeamRow[] = [
  {
    id: "team-alpha-001",
    name: "Team Alpha",
    email: "alpha.eval@sapthagiri.edu",
    project_title: "[PS-01] AI-Powered Automated Evaluation & Code Analysis Engine",
    project_description:
      "A high-precision multi-modal evaluator pipeline analyzing project proposals, dynamic GitHub code repositories, and responsive web portals with verifiable grading rubrics.",
    github_url: "https://github.com/innovedge-nexus/ai-evaluator",
    website_url: "https://ai-evaluator.nexus.dev",
    pdf_path: "team-alpha-001/presentation.pdf",
    pdf_text:
      "AI-Powered Automated Evaluation Engine proposal. Dynamic code quality profiling, originality indexing, and real-time rubric assessment.",
    final_status: "approved",
    final_override: 67.5,
    override_reason: "Verified evaluation across code modularity, UI responsiveness and proposal clarity.",
    remarks: "Strong implementation with comprehensive architecture diagrams and live API integration.",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date().toISOString(),
    aiFinal: 67.5,
    approvedFinal: 67.5,
    officialFinal: 67.5,
    missing: [],
    overall: "approved",
    evals: {
      pdf: {
        id: "eval-alpha-pdf",
        team_id: "team-alpha-001",
        component: "pdf",
        status: "approved",
        stale: false,
        ai_score: 65,
        final_score: 65,
        max_score: 100,
        confidence: 0.94,
        summary: "Clear problem formulation and strong methodology.",
        model: "google/gemini-3.1-flash-lite",
        error: null,
        approved_by: "dev-admin-id",
        approved_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date().toISOString(),
      },
      github: {
        id: "eval-alpha-gh",
        team_id: "team-alpha-001",
        component: "github",
        status: "approved",
        stale: false,
        ai_score: 70,
        final_score: 70,
        max_score: 100,
        confidence: 0.91,
        summary: "Clean repository structure, TypeScript typing, and automated testing.",
        model: "google/gemini-3.1-flash-lite",
        error: null,
        approved_by: "dev-admin-id",
        approved_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date().toISOString(),
      },
      website: {
        id: "eval-alpha-web",
        team_id: "team-alpha-001",
        component: "website",
        status: "approved",
        stale: false,
        ai_score: 67,
        final_score: 67,
        max_score: 100,
        confidence: 0.89,
        summary: "Responsive design, modern typography and clean interactive layout.",
        model: "google/gemini-3.1-flash-lite",
        error: null,
        approved_by: "dev-admin-id",
        approved_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  },
  {
    id: "team-beta-002",
    name: "Team Beta",
    email: "beta.cyber@sapthagiri.edu",
    project_title: "[PS-03] Decentralized Digital Identity & Credential Verification",
    project_description:
      "A privacy-preserving cryptographic signature and zero-knowledge credential verification framework safeguarding academic hackathon certificates from duplication.",
    github_url: "https://github.com/innovedge-nexus/zk-credentials",
    website_url: "https://zk-credentials.nexus.dev",
    pdf_path: "team-beta-002/presentation.pdf",
    pdf_text:
      "Decentralized Digital Identity and Credential Verification. Cryptographic trust anchored on distributed public ledger.",
    final_status: "pending",
    final_override: null,
    override_reason: null,
    remarks: null,
    created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
    updated_at: new Date().toISOString(),
    aiFinal: null,
    approvedFinal: null,
    officialFinal: null,
    missing: ["pdf", "github", "website"],
    overall: "pending",
    evals: {},
  },
  {
    id: "team-gamma-003",
    name: "Team Gamma",
    email: "gamma.health@sapthagiri.edu",
    project_title: "[PS-02] Smart Healthcare Patient Triage & Diagnostic Assistant",
    project_description:
      "A clinician-in-the-loop diagnostic decision support platform prioritizing emergency room triage queues and providing automated vital analytics for rural health clinics.",
    github_url: "https://github.com/innovedge-nexus/pulsemed-triage",
    website_url: "https://pulsemed.nexus.dev",
    pdf_path: "team-gamma-003/presentation.pdf",
    pdf_text:
      "Smart Healthcare Patient Triage Assistant. Clinical decision support system utilizing explainable AI symptom modeling.",
    final_status: "pending",
    final_override: null,
    override_reason: null,
    remarks: null,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    updated_at: new Date().toISOString(),
    aiFinal: null,
    approvedFinal: null,
    officialFinal: null,
    missing: ["pdf", "github", "website"],
    overall: "pending",
    evals: {},
  },
];

export const INITIAL_MEMBERS: Record<string, { name: string; email: string }[]> = {
  "team-alpha-001": [
    { name: "Aarav Sharma", email: "aarav@sapthagiri.edu" },
    { name: "Diya Rao", email: "diya@sapthagiri.edu" },
  ],
  "team-beta-002": [
    { name: "Rohan Patel", email: "rohan@sapthagiri.edu" },
    { name: "Ananya Iyer", email: "ananya@sapthagiri.edu" },
    { name: "Kiran V.", email: "kiran@sapthagiri.edu" },
  ],
  "team-gamma-003": [
    { name: "Meera Nair", email: "meera@sapthagiri.edu" },
    { name: "Siddharth Joshi", email: "siddharth@sapthagiri.edu" },
  ],
};

/** Load teams from persistent local storage */
export function getPersistentTeams(): TeamRow[] {
  if (typeof window === "undefined") return INITIAL_TEAMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First time initialization: seed the 3 default hackathon teams
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TEAMS));
      return INITIAL_TEAMS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((t) => ({
        ...t,
        evals: t.evals || {},
        missing: t.missing || [],
        overall: t.overall || "pending",
      }));
    }
    // If empty array was stored accidentally, restore initial teams
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TEAMS));
    return INITIAL_TEAMS;
  } catch {
    return INITIAL_TEAMS;
  }
}

/** Save teams to persistent storage */
export function savePersistentTeams(teams: TeamRow[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  } catch (err) {
    console.warn("Failed to persist teams to localStorage:", err);
  }
}

/** Save a single team (add or update) */
export function upsertPersistentTeam(team: TeamRow): void {
  const current = getPersistentTeams();
  const idx = current.findIndex((t) => t.id === team.id);
  let updated: TeamRow[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = { ...updated[idx], ...team };
  } else {
    updated = [team, ...current];
  }
  savePersistentTeams(updated);
}

/** Update specific fields on a team */
export function updatePersistentTeam(id: string, updates: Partial<TeamRow>): void {
  const current = getPersistentTeams();
  const updated = current.map((t) => (t.id === id ? { ...t, ...updates } : t));
  savePersistentTeams(updated);
}

/** Explicitly delete a team (ONLY deleted when user confirms deletion) */
export function deletePersistentTeam(id: string): void {
  const current = getPersistentTeams();
  const updated = current.filter((t) => t.id !== id);
  savePersistentTeams(updated);
}

/** Get persistent members for a team */
export function getPersistentMembers(teamId: string): { name: string; email: string }[] {
  if (typeof window === "undefined") return INITIAL_MEMBERS[teamId] ?? [];
  try {
    const raw = localStorage.getItem(MEMBERS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : INITIAL_MEMBERS;
    return map[teamId] ?? INITIAL_MEMBERS[teamId] ?? [];
  } catch {
    return INITIAL_MEMBERS[teamId] ?? [];
  }
}

/** Save persistent members for a team */
export function savePersistentMembers(teamId: string, members: { name: string; email: string }[]): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(MEMBERS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : { ...INITIAL_MEMBERS };
    map[teamId] = members;
    localStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}
