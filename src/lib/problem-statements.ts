import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./db";

export type ProblemStatement = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  requirements?: string;
  created_at?: string;
  updated_at?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_PROBLEM_STATEMENTS: ProblemStatement[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    code: "PS-01",
    title: "Messy Data Repair Engine",
    category: "Data Engineering & AI Systems",
    description:
      "Build an automated, intelligent data cleaning, missing-value imputation, and deduplication engine that ingests corrupted, inconsistent, or partially missing multi-modal datasets and restores relational and statistical integrity with minimal human supervision.",
    requirements:
      "Automated schema reconciliation, robust statistical & ML-driven missing value imputation, entity resolution/deduplication, anomaly detection, and interactive before/after data validation reports.",
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    code: "PS-02",
    title: "Automatic Software Bug Repair System",
    category: "Developer Tools & AI Agents",
    description:
      "Develop an autonomous program analysis and neural patch synthesis system that ingests failing test suites or stack traces, pinpoints root-cause faults in source code, and produces syntactically and semantically correct bug patches.",
    requirements:
      "Static AST and dynamic trace analysis, automated fault localization (FL), constraint-guided LLM patch generation, regression test verification, and automated PR generation with patch explanations.",
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    code: "PS-03",
    title: "Research Claim and Citation Checker",
    category: "Academic Integrity & NLP",
    description:
      "Construct an evidence-grounded research validation tool that inspects scientific papers and preprints, cross-references factual assertions against published literature corpora, and flags fabricated citations, retracted paper references, or unsubstantiated claims.",
    requirements:
      "Cross-document citation graph indexing, automated claim extraction, semantic citation context alignment, retracted paper database verification, and confidence-scored claim support/refutation reports.",
  },
  {
    id: "d4444444-4444-4444-8444-444444444444",
    code: "PS-04",
    title: "Fake News and Deepfake Detection System",
    category: "Cybersecurity & Media Forensics",
    description:
      "Create a multimodal truth verification and forensics engine capable of detecting synthetic video manipulation (face swaps, lip-sync tampering), generated voice clones, and viral disinformation narratives across digital media channels.",
    requirements:
      "Spatial-temporal video anomaly detection, acoustic frequency artifacts analysis for voice clones, narrative provenance cross-checking, and explainable forensic heatmaps for moderator review.",
  },
];

const LOCAL_STORAGE_KEY = "assessor_problem_statements";
const DELETED_STORAGE_KEY = "assessor_deleted_problem_statements";

function loadLocal(): ProblemStatement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(items: ProblemStatement[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function getDeletedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function markDeletedId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(DELETED_STORAGE_KEY, JSON.stringify(deleted));
    }
  } catch {}
}

const OFFICIAL_TITLES = [
  "messy data repair engine",
  "automatic software bug repair system",
  "research claim and citation checker",
  "fake news and deepfake detection system",
];

const LEGACY_DEFAULT_KEYWORDS = [
  "traffic",
  "mobility optimization",
  "triage",
  "diagnostic assistant",
  "decentralized digital identity",
  "credential verification",
  "precision agriculture",
  "crop disease",
];

export async function fetchProblemStatements(): Promise<ProblemStatement[]> {
  // One-time catalog purge to clean out all legacy default data (Traffic, Healthcare triage, Identity, Agriculture, etc.)
  if (typeof window !== "undefined") {
    const catalogV6 = localStorage.getItem("innovedge_ps_catalog_v6");
    if (!catalogV6) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(DELETED_STORAGE_KEY);
      saveLocal(DEFAULT_PROBLEM_STATEMENTS);
      localStorage.setItem("innovedge_ps_catalog_v6", "true");
      return DEFAULT_PROBLEM_STATEMENTS;
    }
  }

  const deletedIds = getDeletedIds();

  // Try fetching from Supabase database
  let dbItems: ProblemStatement[] = [];
  try {
    const { data, error } = await supabase
      .from("evaluation_templates")
      .select("*")
      .eq("component", "problem_statement")
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      dbItems = data
        .map((row) => {
          const c = (row.criteria ?? {}) as any;
          return {
            id: row.id,
            code: c.code || row.name.split(" - ")[0] || "PS",
            title: c.title || (row.name.includes(" - ") ? row.name.split(" - ").slice(1).join(" - ") : row.name),
            category: c.category || "General",
            description: c.description || "",
            requirements: c.requirements || "",
            created_at: row.created_at,
            updated_at: c.updated_at || row.created_at,
          };
        })
        .filter((ps) => !deletedIds.includes(ps.id));
    }
  } catch (err) {
    console.warn("Database fetch warning:", err);
  }

  // Fallback to local storage
  const cached = loadLocal().filter((x) => !deletedIds.includes(x.id));

  // Merge DB and cached
  const combinedMap = new Map<string, ProblemStatement>();
  cached.forEach((item) => combinedMap.set(item.id, item));
  dbItems.forEach((item) => combinedMap.set(item.id, item));

  // Filter out any legacy non-official problem statements (e.g. Adaptive Traffic, Healthcare Triage, etc.)
  const activeItems = Array.from(combinedMap.values()).filter((item) => {
    const titleLower = item.title.toLowerCase();
    const isLegacy =
      item.id.startsWith("default-") ||
      LEGACY_DEFAULT_KEYWORDS.some((kw) => titleLower.includes(kw));
    const isOfficial = OFFICIAL_TITLES.some((t) => titleLower.includes(t));

    // If it's an old legacy default statement, purge it permanently from storage and Supabase DB
    if (isLegacy && !isOfficial) {
      markDeletedId(item.id);
      if (UUID_REGEX.test(item.id)) {
        supabase.from("evaluation_templates").delete().eq("id", item.id).then(() => {});
      }
      return false;
    }
    return true;
  });

  // Ensure all 4 official problem statements are present
  for (const def of DEFAULT_PROBLEM_STATEMENTS) {
    const found = activeItems.some(
      (item) => item.title.toLowerCase().trim() === def.title.toLowerCase().trim()
    );
    if (!found && !deletedIds.includes(def.id)) {
      activeItems.push(def);
    }
  }

  // Normalize codes for the 4 official problem statements to PS-01, PS-02, PS-03, PS-04
  const codeMapping: Record<string, string> = {
    "messy data repair engine": "PS-01",
    "automatic software bug repair system": "PS-02",
    "research claim and citation checker": "PS-03",
    "fake news and deepfake detection system": "PS-04",
  };

  const normalized = activeItems.map((item) => {
    const match = OFFICIAL_TITLES.find((t) => item.title.toLowerCase().includes(t));
    if (match && codeMapping[match]) {
      return { ...item, code: codeMapping[match] };
    }
    return item;
  });

  // Sort by code PS-01 to PS-04
  normalized.sort((a, b) => a.code.localeCompare(b.code));

  saveLocal(normalized);
  return normalized;
}

export async function createProblemStatement(ps: Omit<ProblemStatement, "id">): Promise<ProblemStatement> {
  const generatedId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;

  const name = `${ps.code} - ${ps.title}`;
  const criteriaPayload = {
    code: ps.code.trim(),
    title: ps.title.trim(),
    category: ps.category.trim(),
    description: ps.description.trim(),
    requirements: ps.requirements?.trim() || "",
    updated_at: new Date().toISOString(),
  };

  let id = generatedId;
  try {
    const { data, error } = await supabase
      .from("evaluation_templates")
      .insert({
        component: "problem_statement",
        name,
        criteria: criteriaPayload as any,
      })
      .select()
      .single();

    if (!error && data) {
      id = data.id;
    }
  } catch (err) {
    console.warn("Database insert skipped, saving locally:", err);
  }

  const created: ProblemStatement = {
    id,
    ...ps,
    created_at: new Date().toISOString(),
    updated_at: criteriaPayload.updated_at,
  };

  const existing = loadLocal();
  saveLocal([...existing.filter((x) => x.id !== created.id), created]);
  try {
    await logActivity("Added problem statement", `${created.code}: ${created.title}`);
  } catch {}
  return created;
}

export async function updateProblemStatement(id: string, ps: Partial<ProblemStatement>): Promise<void> {
  // If it's a valid UUID, attempt database update
  if (UUID_REGEX.test(id)) {
    try {
      const { data: existing } = await supabase
        .from("evaluation_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (existing) {
        const prev = (existing.criteria ?? {}) as any;
        const updatedCode = (ps.code ?? prev.code ?? "").trim();
        const updatedTitle = (ps.title ?? prev.title ?? "").trim();
        const updatedCriteria = {
          ...prev,
          code: updatedCode,
          title: updatedTitle,
          category: (ps.category ?? prev.category ?? "").trim(),
          description: (ps.description ?? prev.description ?? "").trim(),
          requirements: (ps.requirements ?? prev.requirements ?? "").trim(),
          updated_at: new Date().toISOString(),
        };
        const name = `${updatedCode} - ${updatedTitle}`;

        await supabase
          .from("evaluation_templates")
          .update({
            name,
            criteria: updatedCriteria as any,
          })
          .eq("id", id);
      }
    } catch (err) {
      console.warn("Database update error (handled locally):", err);
    }
  }

  // Update local storage backup
  const list = loadLocal();
  const updatedList = list.map((item) => (item.id === id ? { ...item, ...ps, updated_at: new Date().toISOString() } : item));
  saveLocal(updatedList);
  try {
    await logActivity("Updated problem statement", `${ps.code ?? id}: ${ps.title ?? ""}`);
  } catch {}
}

export async function deleteProblemStatement(id: string): Promise<void> {
  // 1. Mark as deleted so it can never be resurrected
  markDeletedId(id);

  // 2. Remove from local store immediately
  const list = loadLocal();
  const remaining = list.filter((x) => x.id !== id);
  saveLocal(remaining);

  // 3. If it's a valid UUID, delete from remote database
  if (UUID_REGEX.test(id)) {
    try {
      await supabase.from("evaluation_templates").delete().eq("id", id);
    } catch (err) {
      console.warn("Database deletion skipped or failed:", err);
    }
  }

  try {
    await logActivity("Deleted problem statement", id);
  } catch {}
}

export async function seedDefaultProblemStatements(): Promise<ProblemStatement[]> {
  const createdList: ProblemStatement[] = [];
  for (const item of DEFAULT_PROBLEM_STATEMENTS) {
    const created = await createProblemStatement(item);
    createdList.push(created);
  }
  return createdList;
}

export function formatProblemStatementLabel(ps: ProblemStatement): string {
  return `[${ps.code}] ${ps.title}`;
}

