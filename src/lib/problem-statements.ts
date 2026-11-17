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

export const DEFAULT_PROBLEM_STATEMENTS: Omit<ProblemStatement, "id">[] = [
  {
    code: "PS-01",
    title: "AI-Powered Adaptive Traffic & Mobility Optimization",
    category: "Smart Cities & IoT",
    description:
      "Design and build an intelligent traffic management system that uses computer vision and real-time sensor data to optimize signal timings, alleviate urban bottlenecks, and prioritize emergency vehicles.",
    requirements:
      "Demonstrate dynamic signal scheduling algorithms, real-time vehicle flow metrics, and a responsive traffic monitoring dashboard.",
  },
  {
    code: "PS-02",
    title: "Smart Healthcare Patient Triage & Diagnostic Assistant",
    category: "Healthcare & MedTech",
    description:
      "Develop a secure clinical decision support assistant that aids healthcare providers in symptom triaging, risk stratification, and patient queue prioritization while upholding strict medical data privacy.",
    requirements:
      "Explainable AI assessments, HIPAA/GDPR-conscious data handling, urgency scoring, and clinician verification controls.",
  },
  {
    code: "PS-03",
    title: "Decentralized Digital Identity & Credential Verification",
    category: "Cybersecurity & Web3",
    description:
      "Create a tamper-proof verification portal for academic, government, or employment credentials leveraging cryptographic signatures to prevent credential forgery and streamline background verification.",
    requirements:
      "Cryptographic signature validation pipeline, zero-knowledge/privacy-preserving workflow, and an intuitive verifier inspection interface.",
  },
  {
    code: "PS-04",
    title: "Precision Agriculture & Crop Disease Detection Engine",
    category: "Agritech & Sustainability",
    description:
      "Build an accessible mobile-friendly platform for smallholder farmers that diagnoses crop pathogens from plant imagery and provides geo-targeted organic remedy and irrigation recommendations.",
    requirements:
      "Offline-first capability, multimodal disease classification, localized actionable guidance, and soil/weather impact insights.",
  },
  {
    code: "PS-05",
    title: "Messy Data Repair Engine",
    category: "Data Engineering & AI Systems",
    description:
      "Build an automated, intelligent data cleaning, missing-value imputation, and deduplication engine that ingests corrupted, inconsistent, or partially missing multi-modal datasets and restores relational and statistical integrity with minimal human supervision.",
    requirements:
      "Automated schema reconciliation, robust statistical & ML-driven missing value imputation, entity resolution/deduplication, anomaly detection, and interactive before/after data validation reports.",
  },
  {
    code: "PS-06",
    title: "Automatic Software Bug Repair System",
    category: "Developer Tools & AI Agents",
    description:
      "Develop an autonomous program analysis and neural patch synthesis system that ingests failing test suites or stack traces, pinpoints root-cause faults in source code, and produces syntactically and semantically correct bug patches.",
    requirements:
      "Static AST and dynamic trace analysis, automated fault localization (FL), constraint-guided LLM patch generation, regression test verification, and automated PR generation with patch explanations.",
  },
  {
    code: "PS-07",
    title: "Research Claim and Citation Checker",
    category: "Academic Integrity & NLP",
    description:
      "Construct an evidence-grounded research validation tool that inspects scientific papers and preprints, cross-references factual assertions against published literature corpora, and flags fabricated citations, retracted paper references, or unsubstantiated claims.",
    requirements:
      "Cross-document citation graph indexing, automated claim extraction, semantic citation context alignment, retracted paper database verification, and confidence-scored claim support/refutation reports.",
  },
  {
    code: "PS-08",
    title: "Fake News and Deepfake Detection System",
    category: "Cybersecurity & Media Forensics",
    description:
      "Create a multimodal truth verification and forensics engine capable of detecting synthetic video manipulation (face swaps, lip-sync tampering), generated voice clones, and viral disinformation narratives across digital media channels.",
    requirements:
      "Spatial-temporal video anomaly detection, acoustic frequency artifacts analysis for voice clones, narrative provenance cross-checking, and explainable forensic heatmaps for moderator review.",
  },
];

const LOCAL_STORAGE_KEY = "assessor_problem_statements";

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

export async function fetchProblemStatements(): Promise<ProblemStatement[]> {
  try {
    const { data, error } = await supabase
      .from("evaluation_templates")
      .select("*")
      .eq("component", "problem_statement")
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      const parsed: ProblemStatement[] = data.map((row) => {
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
      });
      // Check if any default challenge is missing, merge it in
      const missingDefaults = DEFAULT_PROBLEM_STATEMENTS.filter(
        (d) =>
          !parsed.some(
            (p) =>
              p.code.toLowerCase() === d.code.toLowerCase() ||
              p.title.toLowerCase() === d.title.toLowerCase()
          )
      );
      const combined = [
        ...parsed,
        ...missingDefaults.map((m, idx) => ({ ...m, id: `default-${parsed.length + idx + 1}` })),
      ];
      saveLocal(combined);
      return combined;
    }
  } catch (err) {
    console.warn("Failed to fetch problem statements from database, checking local cache:", err);
  }

  // Fallback to local storage or defaults
  const cached = loadLocal();
  if (cached.length > 0) {
    const missing = DEFAULT_PROBLEM_STATEMENTS.filter(
      (d) =>
        !cached.some(
          (c) =>
            c.code.toLowerCase() === d.code.toLowerCase() ||
            c.title.toLowerCase() === d.title.toLowerCase()
        )
    );
    if (missing.length > 0) {
      const merged = [
        ...cached,
        ...missing.map((m, idx) => ({ ...m, id: `default-${cached.length + idx + 1}` })),
      ];
      saveLocal(merged);
      return merged;
    }
    return cached;
  }

  // If completely empty, return defaults with generated IDs
  const initial = DEFAULT_PROBLEM_STATEMENTS.map((ps, i) => ({
    ...ps,
    id: `default-${i + 1}`,
  }));
  saveLocal(initial);
  return initial;
}

export async function createProblemStatement(ps: Omit<ProblemStatement, "id">): Promise<ProblemStatement> {
  const name = `${ps.code} - ${ps.title}`;
  const criteriaPayload = {
    code: ps.code.trim(),
    title: ps.title.trim(),
    category: ps.category.trim(),
    description: ps.description.trim(),
    requirements: ps.requirements?.trim() || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("evaluation_templates")
    .insert({
      component: "problem_statement",
      name,
      criteria: criteriaPayload as any,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to create problem statement in database.");
  }

  const created: ProblemStatement = {
    id: data.id,
    ...ps,
    created_at: data.created_at,
    updated_at: criteriaPayload.updated_at,
  };
  const existing = loadLocal();
  saveLocal([...existing.filter((x) => x.id !== created.id), created]);
  await logActivity("Added problem statement", `${created.code}: ${created.title}`);
  return created;
}

export async function updateProblemStatement(id: string, ps: Partial<ProblemStatement>): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from("evaluation_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !existing) {
    throw new Error(fetchError?.message || "Problem statement not found in database.");
  }

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

  const { error: updateError } = await supabase
    .from("evaluation_templates")
    .update({
      name,
      criteria: updatedCriteria as any,
    })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update problem statement in database.");
  }

  // Update local storage backup
  const list = loadLocal();
  const updatedList = list.map((item) => (item.id === id ? { ...item, ...ps, updated_at: new Date().toISOString() } : item));
  saveLocal(updatedList);
  await logActivity("Updated problem statement", `${ps.code ?? id}: ${ps.title ?? ""}`);
}

export async function deleteProblemStatement(id: string): Promise<void> {
  const { error } = await supabase.from("evaluation_templates").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "Failed to delete problem statement from database.");
  }

  const list = loadLocal();
  saveLocal(list.filter((x) => x.id !== id));
  await logActivity("Deleted problem statement", id);
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

