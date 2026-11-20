import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fetchAll } from "./db";
import { COMPONENTS, weightedFinal, type Component, type Weights } from "./scoring";
import {
  DEFAULT_WEIGHTS,
  getPersistentTeams,
  savePersistentTeams,
  upsertPersistentTeam,
  getPersistentMembers,
} from "./team-store";
import { useAuth } from "./auth-context";

export type Team = Tables<"teams">;
export type Evaluation = Tables<"evaluations">;

export const DEFAULT_SYSTEM_SETTINGS = {
  id: 1,
  model: "google/gemini-3.1-flash-lite",
  rpm: 15,
  concurrency: 2,
  batch_size: 10,
  max_retries: 3,
  max_pdf_mb: 3,
  daily_request_limit: 1000,
  scoring_instructions: "Be strict and fair. Only award marks supported by evidence.",
  queue_paused: false,
  quota_exhausted: false,
  quota_message: null,
  updated_at: new Date().toISOString(),
};

function getLocalSettings() {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_SETTINGS;
  try {
    const raw = localStorage.getItem("innovedge_settings");
    if (raw) return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SYSTEM_SETTINGS;
}

function getLocalWeights(): Weights {
  if (typeof window === "undefined") return DEFAULT_WEIGHTS;
  try {
    const raw = localStorage.getItem("innovedge_weights");
    if (raw) return { ...DEFAULT_WEIGHTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_WEIGHTS;
}

export const useWeights = () =>
  useQuery({
    queryKey: ["weights"],
    initialData: getLocalWeights,
    staleTime: 60 * 1000,
    queryFn: async () => {
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
        const req = supabase.from("evaluation_components").select("*");
        const { data, error }: any = await Promise.race([req, timeout]);
        if (!error && data && data.length > 0) {
          const w = Object.fromEntries(data.map((c: any) => [c.key, Number(c.weight)])) as Weights;
          if (typeof window !== "undefined") localStorage.setItem("innovedge_weights", JSON.stringify(w));
          return w;
        }
      } catch (err) {}
      return getLocalWeights();
    },
  });

export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    initialData: getLocalSettings,
    staleTime: 60 * 1000,
    queryFn: async () => {
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
        const req = supabase.from("system_settings").select("*").eq("id", 1).single();
        const { data, error }: any = await Promise.race([req, timeout]);
        if (!error && data) {
          if (typeof window !== "undefined") localStorage.setItem("innovedge_settings", JSON.stringify(data));
          return data;
        }
      } catch (err) {}
      return getLocalSettings();
    },
  });

export type TeamMember = {
  id?: string | undefined;
  name: string;
  email: string | null;
  position?: number | undefined;
};

export type TeamRow = Team & {
  college?: string | undefined;
  track?: string | undefined;
  problem_statement?: string | undefined;
  members?: TeamMember[] | undefined;
  evals: Partial<Record<Component, Evaluation>>;
  aiFinal: number | null;
  approvedFinal: number | null;
  officialFinal: number | null;
  missing: Component[];
  overall: string;
};

export function extractTeamMetadata(t: { remarks?: string | null; email?: string | null; project_title?: string | null }) {
  let college = "";
  let track = "";
  let psCode = "";

  if (t.remarks) {
    const colMatch = t.remarks.match(/College:\s*([^|]+)/i);
    if (colMatch?.[1]) college = colMatch[1].trim();

    const trackMatch = t.remarks.match(/Track:\s*([^|]+)/i);
    if (trackMatch?.[1]) track = trackMatch[1].trim();

    const psMatch = t.remarks.match(/PS:\s*([^|]+)/i);
    if (psMatch?.[1]) psCode = psMatch[1].trim();
  }

  // Fallback college from email domain
  if (!college && t.email) {
    const emailLower = t.email.toLowerCase();
    if (emailLower.includes("sapthagiri")) {
      college = "Sapthagiri College of Engineering";
    } else if (emailLower.includes("bmsce")) {
      college = "BMS College of Engineering";
    } else if (emailLower.includes("pes.edu")) {
      college = "PES University";
    }
  }

  // Fallback PS from project_title "[PS-01] ..."
  if (!psCode && t.project_title) {
    const codeMatch = t.project_title.match(/^\[(PS-\d+|[^\]]+)\]/i);
    if (codeMatch?.[1]) psCode = codeMatch[1].trim();
  }

  return { college, track, psCode };
}

export function overallStatus(t: Team, evals: Partial<Record<Component, Evaluation>>) {
  if (t.final_status === "approved") return "approved";
  if (t.final_status === "rejected") return "rejected";
  const list = COMPONENTS.map((c) => evals[c]);
  if (list.some((e) => e?.status === "processing")) return "processing";
  if (list.some((e) => e?.status === "failed")) return "failed";
  if (list.some((e) => e?.stale)) return "stale";
  if (list.every((e) => e && ["completed", "approved"].includes(e.status))) return "completed";
  return "pending";
}

export const useTeamRows = (_explicitUserId?: string | null) => {
  const weights = useWeights();
  return useQuery({
    queryKey: ["team-rows", weights.data],
    queryFn: async () => {
      const activeWeights = weights.data ?? DEFAULT_WEIGHTS;

      try {
        const [teams, evals, membersData] = await Promise.all([
          fetchAll<Team>("teams"),
          fetchAll<Evaluation>("evaluations"),
          fetchAll<Tables<"team_members">>("team_members").catch(() => []),
        ]);

        const byTeam = new Map<string, Evaluation[]>();
        (evals ?? []).forEach((e) => byTeam.set(e.team_id, [...(byTeam.get(e.team_id) ?? []), e]));

        const membersByTeam = new Map<string, TeamMember[]>();
        (membersData ?? []).forEach((m) => {
          const list = membersByTeam.get(m.team_id) ?? [];
          list.push({ id: m.id, name: m.name, email: m.email, position: m.position });
          membersByTeam.set(m.team_id, list);
        });

        const liveRows = (teams ?? []).map((t): TeamRow => {
          const list = byTeam.get(t.id) ?? [];
          const ev = Object.fromEntries(list.map((e) => [e.component, e])) as TeamRow["evals"];
          const norm = list.map((e) => ({
            ...e,
            ai_score: e.ai_score,
            final_score: e.final_score,
            max_score: e.max_score,
          }));
          const ai = weightedFinal(norm, activeWeights, "ai");
          const ap = weightedFinal(norm, activeWeights, "approved");
          const meta = extractTeamMetadata(t);
          const teamMembers = membersByTeam.get(t.id) ?? getPersistentMembers(t.id);

          return {
            ...t,
            college: meta.college || undefined,
            track: meta.track || undefined,
            problem_statement: meta.psCode || undefined,
            members: teamMembers,
            evals: ev,
            aiFinal: ai.score,
            approvedFinal: ap.score,
            officialFinal: t.final_override ?? ap.score ?? ai.score,
            missing: ap.missing,
            overall: overallStatus(t, ev),
          };
        });

        // Backup to local storage for offline resilience
        savePersistentTeams(liveRows);
        return liveRows;
      } catch (err) {
        console.warn("Failed to fetch teams from Supabase database, retrieving from local storage:", err);
        return getPersistentTeams();
      }
    },
  });
};

/** Team-isolated hook to query authoritative Supabase evaluations for a specific team */
export const useTeamEvaluation = (teamId?: string | null) =>
  useQuery({
    queryKey: ["team-evaluation", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      if (!teamId) return {};
      const { data, error } = await supabase
        .from("evaluations")
        .select("*")
        .eq("team_id", teamId);
      if (error || !data) return {};
      return Object.fromEntries(data.map((e) => [e.component, e])) as Partial<Record<Component, Evaluation>>;
    },
  });

/** Team-isolated hook to query authoritative Supabase criterion breakdown for an evaluation */
export const useTeamCriterionScores = (evalId?: string | null) =>
  useQuery({
    queryKey: ["criterion_scores", evalId],
    enabled: !!evalId,
    queryFn: async () => {
      if (!evalId) return [];
      const { data, error } = await supabase
        .from("criterion_scores")
        .select("*")
        .eq("evaluation_id", evalId)
        .order("position");
      if (error || !data) return [];
      return data;
    },
  });
