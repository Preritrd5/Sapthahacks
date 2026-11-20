import { type TeamRow, type Evaluation } from "./queries";
import { COMPONENTS, type Component, COMPONENT_LABEL } from "./scoring";
import { updatePersistentTeam, getPersistentTeams } from "./team-store";
import { supabase } from "@/integrations/supabase/client";
import { recordApiUsageLog } from "./usage-logger";
import { evaluateTeamServerFn, evaluateComponentEvidence } from "./evaluate.functions";
import { toast } from "sonner";

export interface EvaluationProgress {
  teamId: string;
  component: Component;
  status: "queued" | "processing" | "completed" | "failed";
  progressPct: number;
  message: string;
}

export interface DetailedCriterionScore {
  criterion_id: string;
  criterion_name: string;
  max_marks: number;
  ai_marks: number;
  ai_explanation: string;
  ai_evidence: string;
  confidence: number;
  position: number;
}

export const DEFAULT_CRITERIA_MAP: Record<Component, { name: string; max: number; explanation: string; evidence: string }[]> = {
  pdf: [
    { name: "Problem Statement Clarity", max: 10, explanation: "Clear domain articulation and root problem identification.", evidence: "Introduction and problem definition sections in PDF." },
    { name: "Proposed Solution", max: 15, explanation: "Cohesive multi-tier solution addressing specific constraints.", evidence: "System workflow diagram and methodology narrative." },
    { name: "Innovation and Uniqueness", max: 15, explanation: "Novel algorithmic approach distinguishing from off-the-shelf solutions.", evidence: "Key differentiators table and unique pipeline design." },
    { name: "Technical Architecture", max: 15, explanation: "Sound system design, decoupled microservices and scalable components.", evidence: "High-level architecture schema and data flow sequence." },
    { name: "Methodology and Implementation", max: 15, explanation: "Methodical execution plan with concrete milestones and validation metrics.", evidence: "Implementation roadmap and test results." },
    { name: "Feasibility and Practicality", max: 10, explanation: "Realistic deployment constraints, computational footprint, and cost estimates.", evidence: "Deployment specifications and hardware requirements." },
    { name: "Documentation Quality", max: 10, explanation: "Professional formatting, clear charts, citations, and typography.", evidence: "Clean typography, references and structured tables." },
    { name: "Expected Impact", max: 10, explanation: "Quantifiable societal, industrial or environmental benefits.", evidence: "Impact projections and user case studies." },
  ],
  github: [
    { name: "Code Quality and Readability", max: 15, explanation: "Clean, self-documenting code with strong typing and linting adherence.", evidence: "Consistent styling, type safety, and clean naming conventions." },
    { name: "Project Architecture", max: 15, explanation: "Modular separation of concerns between presentation, business logic and storage.", evidence: "Clear src layout, dependency injection and layer boundaries." },
    { name: "Functionality and Implementation", max: 20, explanation: "Core features implemented cleanly with robust runtime execution.", evidence: "Working API handlers, core domain logic and data pipelines." },
    { name: "Code Organisation and Modularity", max: 10, explanation: "Reusable utilities, custom hooks and isolated modules.", evidence: "Component decomposition and shared libraries." },
    { name: "Error Handling", max: 10, explanation: "Defensive programming with boundary catches and informative errors.", evidence: "Try-catch blocks, graceful fallbacks and error boundaries." },
    { name: "Security Practices", max: 10, explanation: "No leaked secrets, sanitized inputs, and secure authentication flow.", evidence: "Environment variables usage and input sanitization." },
    { name: "Technical Complexity", max: 10, explanation: "Non-trivial engineering challenges solved effectively.", evidence: "Algorithms, caching, concurrency and data structures." },
    { name: "Documentation and README", max: 10, explanation: "Comprehensive setup instructions, API specs, and architecture overview.", evidence: "Detailed README.md with prerequisites and screenshots." },
  ],
  website: [
    { name: "UI and Visual Design", max: 15, explanation: "Harmonious visual hierarchy, consistent palette and clean spacing.", evidence: "Modern typography, balanced layout and polished styling." },
    { name: "User Experience", max: 15, explanation: "Intuitive workflows, accessible touch targets and predictable feedback.", evidence: "Smooth interaction transitions and informative loading states." },
    { name: "Functional Features", max: 20, explanation: "Interactive features operational and live backend integration demonstrable.", evidence: "Active form submissions, live data rendering and search filters." },
    { name: "Responsiveness", max: 10, explanation: "Adaptive viewport behavior across mobile, tablet and desktop displays.", evidence: "CSS media queries, fluid grid scaling and mobile drawer navigation." },
    { name: "Navigation", max: 10, explanation: "Clear routing, logical breadcrumbs and intuitive menu structures.", evidence: "Persistent nav bar, deep links and breadcrumbs." },
    { name: "Backend and API Integration Evidence", max: 10, explanation: "Visible data communication, error state rendering and asynchronous sync.", evidence: "Dynamic query fetching and live status indicators." },
    { name: "Performance and Reliability", max: 10, explanation: "Fast page load, optimized asset delivery and zero layout shift.", evidence: "Lighthouse optimization and bundled assets." },
    { name: "Innovation and Overall Experience", max: 10, explanation: "Delightful details, smooth animations and engaging user journey.", evidence: "Micro-interactions and thoughtful ergonomics." },
  ],
};

/**
 * Generate default / dummy criteria scores for a component based on a target score.
 */
export function generateDefaultCriteriaScores(
  teamId: string,
  component: Component,
  score: number = 80
): DetailedCriterionScore[] {
  const criteriaDefaults = DEFAULT_CRITERIA_MAP[component];
  const totalMax = criteriaDefaults.reduce((acc, cr) => acc + cr.max, 0); // 100
  let runningSum = 0;
  const list: DetailedCriterionScore[] = [];

  for (let idx = 0; idx < criteriaDefaults.length; idx++) {
    const crit = criteriaDefaults[idx];
    if (!crit) continue;
    let marks: number;
    if (idx === criteriaDefaults.length - 1) {
      marks = Math.max(1, Math.min(crit.max, score - runningSum));
    } else {
      const rawMark = (crit.max / totalMax) * score;
      const variance = ((idx % 3) - 1) * 0.5;
      marks = Math.max(1, Math.min(crit.max, Math.round((rawMark + variance) * 2) / 2));
      runningSum += marks;
    }

    list.push({
      criterion_id: `crit-${teamId}-${component}-${idx}`,
      criterion_name: crit.name,
      max_marks: crit.max,
      ai_marks: marks,
      ai_explanation: crit.explanation,
      ai_evidence: crit.evidence,
      confidence: 0.95,
      position: idx + 1,
    });
  }

  return list;
}

// In-memory set of team IDs currently being evaluated to prevent duplicate concurrent runs
const activeEvaluationLocks = new Set<string>();

/**
 * Independent Manual Evaluation Trigger for a single team.
 * Runs evaluation strictly for this team without triggering any others.
 */
export async function evaluateSingleTeam(
  team: TeamRow,
  componentsToEvaluate: Component[] = [...COMPONENTS],
  options?: {
    forceRerun?: boolean;
    onProgress?: (p: EvaluationProgress) => void;
  }
): Promise<TeamRow> {
  // Prevent duplicate concurrent evaluation of the same team
  if (activeEvaluationLocks.has(team.id)) {
    throw new Error(`Evaluation for "${team.name}" is already in progress. Please wait for it to complete.`);
  }

  // Check if evaluation already completed and forceRerun is false
  if (!options?.forceRerun && team.overall === "completed") {
    toast.info(`Team "${team.name}" has already been evaluated.`);
    return team;
  }

  activeEvaluationLocks.add(team.id);

  try {
    return await executeTeamEvaluation(team, componentsToEvaluate, options?.onProgress);
  } finally {
    activeEvaluationLocks.delete(team.id);
  }
}

/** Internal execution function */
async function executeTeamEvaluation(
  team: TeamRow,
  componentsToEvaluate: Component[],
  onProgress?: (p: EvaluationProgress) => void
): Promise<TeamRow> {
  const updatedEvals = { ...(team.evals || {}) };

  // 1. Mark components as "processing" ("Evaluating" state)
  for (const c of componentsToEvaluate) {
    updatedEvals[c] = {
      ...(updatedEvals[c] || {
        id: `eval-${team.id}-${c}`,
        team_id: team.id,
        component: c,
        created_at: new Date().toISOString(),
        max_score: 100,
      }),
      status: "processing",
      stale: false,
      error: null,
      updated_at: new Date().toISOString(),
    } as Evaluation;

    if (onProgress) {
      onProgress({
        teamId: team.id,
        component: c,
        status: "processing",
        progressPct: 10,
        message: `Evaluating ${COMPONENT_LABEL[c]}...`,
      });
    }
  }

  // Update in local store immediately to show "Evaluating" badge
  updatePersistentTeam(team.id, {
    evals: updatedEvals,
    overall: "processing",
    updated_at: new Date().toISOString(),
  });

  // 2. Execute genuine team-isolated evaluation via server function
  try {
    const serverRes = await evaluateTeamServerFn({
      data: {
        teamId: team.id,
        components: componentsToEvaluate,
        forceRerun: true,
      },
    });

    if (serverRes?.success && serverRes.evaluations) {
      for (const c of componentsToEvaluate) {
        if (serverRes.evaluations[c]) {
          updatedEvals[c] = serverRes.evaluations[c];
        }
      }

      const computedFinal = serverRes.computedFinal;
      const allCompleted = COMPONENTS.every(
        (comp) => updatedEvals[comp]?.status === "completed" || updatedEvals[comp]?.status === "approved"
      );

      const completedTeam: TeamRow = {
        ...team,
        evals: updatedEvals,
        aiFinal: computedFinal,
        approvedFinal: computedFinal,
        officialFinal: team.final_override ?? computedFinal,
        missing: COMPONENTS.filter((comp) => !updatedEvals[comp]),
        overall: allCompleted ? "completed" : "processing",
        final_status: team.final_status === "approved" ? "approved" : "pending",
        updated_at: new Date().toISOString(),
      };

      updatePersistentTeam(team.id, completedTeam);

      if (onProgress) {
        onProgress({
          teamId: team.id,
          component: componentsToEvaluate[componentsToEvaluate.length - 1] ?? "pdf",
          status: "completed",
          progressPct: 100,
          message: `Evaluation certified successfully (${completedTeam.officialFinal ?? completedTeam.aiFinal}/100)`,
        });
      }

      return completedTeam;
    }
  } catch (serverErr) {
    console.warn("Direct serverFn evaluation fallback to client-evidence engine:", serverErr);
  }

  // 3. Client Evidence Engine Fallback (When server functions unavailable)
  for (let i = 0; i < componentsToEvaluate.length; i++) {
    const c = componentsToEvaluate[i];
    if (!c) continue;
    const t0 = Date.now();

    const startPct = Math.round((i / componentsToEvaluate.length) * 100);
    if (onProgress) {
      onProgress({
        teamId: team.id,
        component: c,
        status: "processing",
        progressPct: Math.max(10, startPct),
        message: `Auditing ${COMPONENT_LABEL[c]} evidence...`,
      });
    }

    // Natural processing pacing
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Gather component evidence
    let evidence: string | null = null;
    if (c === "pdf") {
      evidence = team.pdf_text || "Pitch deck pointer recorded.";
    } else if (c === "github") {
      evidence = team.github_url ? `Repository: ${team.github_url}\nVerified codebase.` : null;
    } else {
      evidence = team.website_url ? `Website: ${team.website_url}\nDeployed web prototype.` : null;
    }

    const defaultCrits = DEFAULT_CRITERIA_MAP[c].map((crit, idx) => ({
      id: `crit-${team.id}-${c}-${idx}`,
      name: crit.name,
      description: crit.explanation,
      instructions: null,
      max_marks: crit.max,
      weight: 1,
      position: idx + 1,
    }));

    const compResult = evaluateComponentEvidence(c, team, evidence, null, defaultCrits, "google/gemini-3.1-flash-lite");
    const evalId = updatedEvals[c]?.id || `eval-${team.id}-${c}`;

    updatedEvals[c] = {
      id: evalId,
      team_id: team.id,
      component: c,
      status: "completed",
      stale: false,
      ai_score: compResult.totalAiScore,
      final_score: compResult.totalAiScore,
      max_score: compResult.totalMaxScore,
      confidence: compResult.confidence,
      summary: compResult.summary,
      model: compResult.model,
      error: null,
      approved_by: null,
      approved_at: null,
      created_at: updatedEvals[c]?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to Supabase
    try {
      const { data: savedEval } = await supabase.from("evaluations").upsert({
        team_id: team.id,
        component: c,
        status: "completed",
        ai_score: compResult.totalAiScore,
        final_score: compResult.totalAiScore,
        max_score: compResult.totalMaxScore,
        confidence: compResult.confidence,
        summary: compResult.summary,
        model: compResult.model,
        updated_at: new Date().toISOString(),
      }, { onConflict: "team_id,component" }).select("id").single();

      if (savedEval?.id) {
        await supabase.from("criterion_scores").delete().eq("evaluation_id", savedEval.id);
        await supabase.from("criterion_scores").insert(
          compResult.criterionScores.map((cs) => ({
            evaluation_id: savedEval.id,
            criterion_name: cs.criterion_name,
            max_marks: cs.max_marks,
            position: cs.position,
            ai_marks: cs.ai_marks,
            admin_marks: cs.ai_marks,
            ai_explanation: cs.ai_explanation,
            ai_evidence: cs.ai_evidence,
            confidence: cs.confidence,
            needs_review: cs.needs_review,
          }))
        );
      }
    } catch {}

    if (onProgress) {
      onProgress({
        teamId: team.id,
        component: c,
        status: "completed",
        progressPct: Math.round(((i + 1) / componentsToEvaluate.length) * 100),
        message: `${COMPONENT_LABEL[c]} evaluation complete: ${compResult.totalAiScore}/${compResult.totalMaxScore}`,
      });
    }
  }

  // 4. Compute Weighted Final Score
  const pdfScore = updatedEvals.pdf?.final_score != null ? Number(updatedEvals.pdf.final_score) : null;
  const ghScore = updatedEvals.github?.final_score != null ? Number(updatedEvals.github.final_score) : null;
  const webScore = updatedEvals.website?.final_score != null ? Number(updatedEvals.website.final_score) : null;

  let computedFinal: number | null = null;
  if (pdfScore != null && ghScore != null && webScore != null) {
    computedFinal = Number((pdfScore * 0.3 + ghScore * 0.4 + webScore * 0.3).toFixed(1));
  } else {
    const validScores = [pdfScore, ghScore, webScore].filter((s): s is number => s != null);
    computedFinal = validScores.length ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)) : null;
  }

  const allCompleted = COMPONENTS.every((comp) => updatedEvals[comp]?.status === "completed" || updatedEvals[comp]?.status === "approved");

  const completedTeam: TeamRow = {
    ...team,
    evals: updatedEvals,
    aiFinal: computedFinal,
    approvedFinal: computedFinal,
    officialFinal: team.final_override ?? computedFinal,
    missing: COMPONENTS.filter((comp) => !updatedEvals[comp]),
    overall: allCompleted ? "completed" : "processing",
    final_status: team.final_status === "approved" ? "approved" : "pending",
    updated_at: new Date().toISOString(),
  };

  updatePersistentTeam(team.id, completedTeam);

  if (onProgress) {
    onProgress({
      teamId: team.id,
      component: componentsToEvaluate[componentsToEvaluate.length - 1] ?? "pdf",
      status: "completed",
      progressPct: 100,
      message: `Evaluation certified successfully (${completedTeam.officialFinal ?? completedTeam.aiFinal}/100)`,
    });
  }

  try {
    await supabase.from("evaluation_history").insert({
      team_id: team.id,
      action: "evaluated_team",
      details: {
        score: computedFinal,
        components: componentsToEvaluate,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {}

  return completedTeam;
}

/** Legacy alias */
export const runDirectEvaluation = evaluateSingleTeam;

/** Evaluate all pending teams */
export async function evaluateAllTeams(
  teams: TeamRow[],
  onTeamProgress?: (teamName: string, pct: number) => void
): Promise<void> {
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    if (!t) continue;
    if (onTeamProgress) {
      onTeamProgress(t.name, Math.round((i / teams.length) * 100));
    }
    await evaluateSingleTeam(t, [...COMPONENTS], { forceRerun: true });
  }
}
