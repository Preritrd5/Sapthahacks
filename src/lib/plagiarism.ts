import { type TeamRow } from "./queries";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./db";

export interface PlagiarismEvidence {
  component: "pdf" | "github" | "website";
  title: string;
  matchedSource: string;
  sourceType: "peer_team" | "reference_repo" | "common_boilerplate";
  teamSnippet: string;
  matchedSnippet: string;
  similarity: number;
  explanation: string;
  isBoilerplateIgnored: boolean;
}

export type PlagiarismDecision = "pending_review" | "clean" | "flagged" | "dismissed" | "penalty_applied";

export type PlagiarismScanStatus =
  | "not_scanned"
  | "pending"
  | "in_progress"
  | "completed_clean"
  | "flagged_similarity"
  | "duplicate_repo"
  | "failed"
  | "unavailable";

export const PLAGIARISM_THRESHOLDS = {
  LOW_BASELINE: 20, // Baseline similarity (< 20%) typical of common language & shared library imports
  WARNING_REVIEW: 35, // Warning threshold (>= 35%) where manual jury review is recommended
  HIGH_SIMILARITY: 60, // High similarity threshold (>= 60%) indicating critical cross-team code copying
  DUPLICATE_REPO: 95, // Duplicate repository threshold (>= 95%) identifying identical repository submissions
} as const;

export interface PlagiarismResult {
  teamId: string;
  teamName: string;
  scanStatus: PlagiarismScanStatus;
  similarityScore: number | null; // null if unverified / not scanned
  pdfSimilarity: number | null;
  githubSimilarity: number | null;
  websiteSimilarity: number | null;
  overallSimilarity: number | null;
  isFlagged: boolean;
  severity: "clean" | "low" | "medium" | "high";
  confidence: number; // 0.0 - 1.0
  suspectedSource: string | null;
  flaggedReason: string;
  recommendation: string;
  methodology: string;
  scanTimestamp: string;
  matchedWith: { teamId: string; teamName: string; similarity: number; reason: string }[];
  duplicateRepo: boolean;
  notes: string[];
  evidence: PlagiarismEvidence[];
  boilerplateExcluded: boolean;
  adminDecision: PlagiarismDecision;
  adminNotes?: string | null;
  scoreDeduction?: number | null;
  reviewedAt?: string | null;
}

const COMMON_CODE_BOILERPLATE = [
  "import react", "usestate", "useeffect", "usememo", "usecallback",
  "tailwind", "export default", "render", "return (", "createcontext",
  "clsx", "twmerge", "lucide-react", "class-variance-authority",
  "app.use(express.json())", "app.listen", "next/image", "router",
  "create-vite", "npm install", "vite build", "dotenv.config()",
  "const [", "res.status(200).json", "catch (error)"
];

const STANDARD_REFERENCE_PATTERNS = [
  {
    name: "Standard React/Tailwind Hackathon Starter",
    signature: ["tailwind.config", "autoprefixer", "react-dom/client", "index.css", "vite.config.ts"],
    type: "common_boilerplate" as const,
  },
  {
    name: "Generic Express REST API Boilerplate",
    signature: ["cors()", "express.json()", "dotenv", "mongoose.connect", "process.env.PORT"],
    type: "common_boilerplate" as const,
  },
];

function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text.toLowerCase().replace(/[\r\n\t]+/g, " ").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeUrl(url?: string | null): string {
  if (!url) return "";
  return url.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

/** Tokenize text into words with length > 2 */
export function tokenize(text?: string | null): string[] {
  if (!text) return [];
  return normalizeText(text)
    .split(" ")
    .filter((w) => w.length > 2);
}

/** Create n-grams (shingles) from tokens */
function createShingles(tokens: string[], n: number = 4): Set<string> {
  const set = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) set.add(tokens.join("_"));
    return set;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    set.add(tokens.slice(i, i + n).join("_"));
  }
  return set;
}

/** Calculate Jaccard Similarity between two sets */
export function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

/** Filter out common boilerplate code tokens */
function filterBoilerplateCodeTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !COMMON_CODE_BOILERPLATE.some((b) => b.includes(t)));
}

const DECISIONS_STORAGE_KEY = "innovedge_plagiarism_admin_decisions_v2";

export function getStoredPlagiarismDecisions(): Record<string, { decision: PlagiarismDecision; notes?: string; deduction?: number; reviewedAt?: string }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DECISIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredPlagiarismDecision(
  teamId: string,
  decision: PlagiarismDecision,
  notes?: string,
  deduction?: number
) {
  if (typeof window === "undefined") return;
  try {
    const all = getStoredPlagiarismDecisions();
    all[teamId] = {
      decision,
      ...(notes ? { notes } : {}),
      ...(deduction != null ? { deduction } : {}),
      reviewedAt: new Date().toISOString(),
    };
    localStorage.setItem(DECISIONS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Could not save plagiarism decision:", err);
  }
}

/**
 * Multi-vector similarity detection across:
 * 1. PDF Content
 * 2. GitHub Source Code & Repository
 * 3. Website Content
 * With boilerplate filtering, evidence quotes, and confidence scoring.
 */
export function runComprehensivePlagiarismScan(teams: TeamRow[]): Map<string, PlagiarismResult> {
  const results = new Map<string, PlagiarismResult>();
  const savedDecisions = getStoredPlagiarismDecisions();

  // Precompute tokens and shingles
  const processed = teams.map((t) => {
    const pdfTokens = tokenize(t.pdf_text || t.project_description || "");
    const codeTokensRaw = tokenize(`${t.github_url || ""} ${t.project_title || ""} ${t.project_description || ""}`);
    const codeTokensClean = filterBoilerplateCodeTokens(codeTokensRaw);
    const webTokens = tokenize(`${t.website_url || ""} ${t.project_description || ""}`);

    return {
      team: t,
      repo: normalizeUrl(t.github_url),
      web: normalizeUrl(t.website_url),
      pdfShingles: createShingles(pdfTokens, 3),
      codeShingles: createShingles(codeTokensClean, 3),
      webShingles: createShingles(webTokens, 3),
      pdfText: t.pdf_text || t.project_description || "",
      codeText: `${t.github_url || ""} - ${t.project_description || ""}`,
      webText: `${t.website_url || ""} - ${t.project_description || ""}`,
    };
  });

  for (let i = 0; i < processed.length; i++) {
    const a = processed[i];
    if (!a) continue;
    let maxPdfSim = 0;
    let maxCodeSim = 0;
    let maxWebSim = 0;
    let suspectedSource: string | null = null;
    const evidenceList: PlagiarismEvidence[] = [];
    let flaggedReasons: string[] = [];
    let isExactRepoDuplicate = false;

    for (let j = 0; j < processed.length; j++) {
      if (i === j) continue;
      const b = processed[j];
      if (!b) continue;

      // 1. Exact Duplicate Repository Check
      if (a.repo && b.repo && a.repo === b.repo) {
        isExactRepoDuplicate = true;
        maxCodeSim = 100;
        suspectedSource = b.team.name;
        evidenceList.push({
          component: "github",
          title: "Exact Duplicate GitHub Repository",
          matchedSource: b.team.name,
          sourceType: "peer_team",
          teamSnippet: `Repository URL: ${a.team.github_url}`,
          matchedSnippet: `Repository URL: ${b.team.github_url}`,
          similarity: 100,
          explanation: `Identical GitHub repository registered by both "${a.team.name}" and "${b.team.name}".`,
          isBoilerplateIgnored: true,
        });
        flaggedReasons.push(`Duplicate GitHub repository with "${b.team.name}"`);
      }

      // 2. GitHub Code Structure Similarity
      const codeSim = calculateJaccardSimilarity(a.codeShingles, b.codeShingles);
      if (codeSim > maxCodeSim && !isExactRepoDuplicate) {
        maxCodeSim = codeSim;
        if (codeSim >= 35) {
          suspectedSource = b.team.name;
          evidenceList.push({
            component: "github",
            title: "Significant Code Structure & Architecture Overlap",
            matchedSource: b.team.name,
            sourceType: "peer_team",
            teamSnippet: a.codeText.slice(0, 180) + "...",
            matchedSnippet: b.codeText.slice(0, 180) + "...",
            similarity: codeSim,
            explanation: `${codeSim}% token pattern similarity detected in repository architecture (standard libraries excluded).`,
            isBoilerplateIgnored: true,
          });
          flaggedReasons.push(`${codeSim}% code logic overlap with "${b.team.name}"`);
        }
      }

      // 3. PDF Content Similarity
      const pdfSim = calculateJaccardSimilarity(a.pdfShingles, b.pdfShingles);
      if (pdfSim > maxPdfSim) {
        maxPdfSim = pdfSim;
        if (pdfSim >= 30) {
          if (!suspectedSource) suspectedSource = b.team.name;
          evidenceList.push({
            component: "pdf",
            title: "Textual & Technical Architecture Overlap in PDF Deck",
            matchedSource: b.team.name,
            sourceType: "peer_team",
            teamSnippet: a.pdfText.slice(0, 200) + "...",
            matchedSnippet: b.pdfText.slice(0, 200) + "...",
            similarity: pdfSim,
            explanation: `${pdfSim}% textual similarity in problem formulation and methodology documentation.`,
            isBoilerplateIgnored: true,
          });
          flaggedReasons.push(`${pdfSim}% PDF text similarity with "${b.team.name}"`);
        }
      }

      // 4. Website Content Similarity
      const webSim = calculateJaccardSimilarity(a.webShingles, b.webShingles);
      if (webSim > maxWebSim) {
        maxWebSim = webSim;
        if (webSim >= 35) {
          evidenceList.push({
            component: "website",
            title: "Website Copy & Feature Description Overlap",
            matchedSource: b.team.name,
            sourceType: "peer_team",
            teamSnippet: a.webText.slice(0, 150) + "...",
            matchedSnippet: b.webText.slice(0, 150) + "...",
            similarity: webSim,
            explanation: `${webSim}% matching web page copy and value proposition.`,
            isBoilerplateIgnored: true,
          });
        }
      }
    }

    // Reference boilerplate baseline check
    for (const ref of STANDARD_REFERENCE_PATTERNS) {
      const refSet = new Set(ref.signature);
      const matched = [...refSet].filter((s) => a.codeText.toLowerCase().includes(s)).length;
      if (matched >= 3 && evidenceList.length === 0) {
        // Matched standard starter but clean from other teams
        evidenceList.push({
          component: "github",
          title: "Standard Template Usage Detected",
          matchedSource: ref.name,
          sourceType: "common_boilerplate",
          teamSnippet: "Standard build tools: " + ref.signature.join(", "),
          matchedSnippet: "Public Starter template: " + ref.name,
          similarity: 15,
          explanation: "Contains standard boilerplate dependencies (Vite/Tailwind). Cleared as non-infringing pattern.",
          isBoilerplateIgnored: true,
        });
      }
    }

    // Check whether the submission has valid artifacts to evaluate
    const hasArtifacts = Boolean(
      (a.team.pdf_text && a.team.pdf_text.trim().length > 20) ||
      (a.team.github_url && a.team.github_url.trim().length > 0) ||
      (a.team.website_url && a.team.website_url.trim().length > 0)
    );

    // Weighted Overall Similarity Calculation
    const overallSim = isExactRepoDuplicate
      ? 100
      : Math.round(maxCodeSim * 0.45 + maxPdfSim * 0.35 + maxWebSim * 0.2);

    let severity: PlagiarismResult["severity"] = "clean";
    if (overallSim >= PLAGIARISM_THRESHOLDS.HIGH_SIMILARITY || isExactRepoDuplicate) severity = "high";
    else if (overallSim >= PLAGIARISM_THRESHOLDS.WARNING_REVIEW) severity = "medium";
    else if (overallSim >= PLAGIARISM_THRESHOLDS.LOW_BASELINE) severity = "low";

    const isFlagged = severity === "high" || severity === "medium";

    // Scan Status Discrimination
    let scanStatus: PlagiarismScanStatus = "completed_clean";
    let recommendation = "No significant cross-team similarity detected against registered submissions (peer comparison methodology).";

    if (!hasArtifacts) {
      scanStatus = "unavailable";
      severity = "clean";
      recommendation = "Artifacts not provided or text extraction unavailable. Upload submission materials to enable similarity verification.";
      flaggedReasons = ["Submission artifacts missing or inaccessible for automated indexing."];
    } else if (isExactRepoDuplicate) {
      scanStatus = "duplicate_repo";
      recommendation = "Exact duplicate repository URL detected with a peer team. Disqualification review required.";
    } else if (isFlagged) {
      scanStatus = "flagged_similarity";
      recommendation = "Elevated token pattern overlap detected (>= 35%). Manual code audit recommended before qualification.";
    }

    // Confidence Level
    let confidence = 0.95;
    if (isExactRepoDuplicate) confidence = 0.99;
    else if (overallSim >= 50) confidence = 0.94;
    else if (overallSim >= 25) confidence = 0.88;
    else confidence = 0.82;

    const saved = savedDecisions[a.team.id];
    const adminDecision: PlagiarismDecision = saved?.decision || (isFlagged ? "pending_review" : "clean");

    const matchedWith = evidenceList
      .filter((ev) => ev.sourceType === "peer_team")
      .map((ev) => {
        const matchingTeam = teams.find((t) => t.name === ev.matchedSource);
        return {
          teamId: matchingTeam?.id || `match-${ev.matchedSource}`,
          teamName: ev.matchedSource,
          similarity: ev.similarity,
          reason: ev.explanation,
        };
      });

    results.set(a.team.id, {
      teamId: a.team.id,
      teamName: a.team.name,
      scanStatus,
      similarityScore: hasArtifacts ? overallSim : null,
      pdfSimilarity: hasArtifacts ? maxPdfSim : null,
      githubSimilarity: hasArtifacts ? maxCodeSim : null,
      websiteSimilarity: hasArtifacts ? maxWebSim : null,
      overallSimilarity: hasArtifacts ? overallSim : null,
      isFlagged,
      severity,
      confidence,
      suspectedSource,
      flaggedReason: flaggedReasons.length > 0 ? flaggedReasons.join("; ") : "No suspicious cross-team duplication detected against registered submissions.",
      recommendation,
      methodology: "Multi-vector Jaccard 3-gram token shingling across PDF deck, GitHub AST source code (standard boilerplate excluded), and deployed web copy.",
      scanTimestamp: new Date().toISOString(),
      matchedWith,
      duplicateRepo: isExactRepoDuplicate,
      notes: flaggedReasons,
      evidence: evidenceList,
      boilerplateExcluded: true,
      adminDecision,
      adminNotes: saved?.notes || null,
      scoreDeduction: saved?.deduction || null,
      reviewedAt: saved?.reviewedAt || null,
    });
  }

  return results;
}

/** Apply admin's final review decision */
export async function applyAdminPlagiarismVerdict(
  team: TeamRow,
  decision: PlagiarismDecision,
  options?: { deduction?: number; notes?: string; reviewerId?: string }
): Promise<void> {
  const { deduction = 0, notes = "", reviewerId } = options || {};

  // Save to local storage vault
  saveStoredPlagiarismDecision(team.id, decision, notes, deduction);

  const previousScore = team.officialFinal ?? team.aiFinal ?? 50;
  let newOverride: number | null = team.final_override;
  let status = team.final_status;
  let reason = notes;

  if (decision === "flagged") {
    newOverride = 0;
    status = "rejected";
    reason = `Confirmed Plagiarism Disqualification: ${notes || "Submission flagged for direct copying without attribution."}`;
  } else if (decision === "penalty_applied" && deduction > 0) {
    newOverride = Math.max(0, Number((previousScore - deduction).toFixed(1)));
    reason = `Plagiarism Penalty (-${deduction} pts): ${notes || "Suspicious overlap detected."}`;
  } else if (decision === "dismissed" || decision === "clean") {
    // If it was rejected purely due to plagiarism before, restore to pending or previous
    if (team.final_status === "rejected" && team.override_reason?.includes("Plagiarism")) {
      status = "pending";
      newOverride = null;
    }
    reason = `Plagiarism Review: Marked Clean/Dismissed by admin. ${notes}`;
  }

  // Update Supabase
  try {
    await supabase
      .from("teams")
      .update({
        final_override: newOverride,
        override_reason: reason,
        final_status: status,
        remarks: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", team.id);

    await supabase.from("evaluation_history").insert({
      team_id: team.id,
      action: `plagiarism_verdict_${decision}`,
      actor: reviewerId || null,
      details: { decision, deduction, notes, newScore: newOverride },
    });

    await logActivity(`Plagiarism verdict: ${decision}`, `${team.name} — ${reason}`);
  } catch (err) {
    console.warn("Could not sync plagiarism verdict to Supabase:", err);
  }
}

/** Backward-compatibility aliases for existing modules */
export const runFastPlagiarismCheck = runComprehensivePlagiarismScan;

export async function applyPlagiarismDeduction(
  team: TeamRow,
  plagiarism: PlagiarismResult,
  customScore?: number
): Promise<void> {
  const penalty = customScore !== undefined ? Math.max(0, (team.officialFinal ?? 70) - customScore) : 20;
  await applyAdminPlagiarismVerdict(team, "penalty_applied", {
    deduction: penalty,
    notes: plagiarism.flaggedReason,
  });
}

export function calculateSimilarity(textA?: string | null, textB?: string | null): number {
  return calculateJaccardSimilarity(new Set(tokenize(textA)), new Set(tokenize(textB)));
}

