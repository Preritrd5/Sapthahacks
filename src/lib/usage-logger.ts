import { supabase } from "@/integrations/supabase/client";

export interface ApiUsageLog {
  id: string;
  model: string;
  component: string;
  team_id?: string | null;
  team_name?: string | null;
  status: "success" | "error" | "failed";
  http_status: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  duration_ms: number;
  estimated_cost_usd: number;
  error?: string | null;
  created_at: string;
}

const STORAGE_KEY = "innovedge_recorded_api_logs_vault";

function getApiStorageKey(userId?: string | null): string {
  if (userId) return `${STORAGE_KEY}_${userId}`;
  return STORAGE_KEY;
}

/**
 * Gemini 3.1 Flash Lite pricing (USD):
 * - Input/Prompt: $0.075 per 1,000,000 tokens
 * - Output/Completion: $0.30 per 1,000,000 tokens
 */
export function calculateTokenCost(promptTokens: number, completionTokens: number, model: string = "gemini-3.1-flash-lite"): number {
  const isFlashLite = model.includes("flash-lite") || model.includes("3.1-flash-lite");
  const isPro = model.includes("pro");

  let inputRatePerMillion = 0.075;
  let outputRatePerMillion = 0.3;

  if (isPro) {
    inputRatePerMillion = 1.25;
    outputRatePerMillion = 5.0;
  } else if (!isFlashLite) {
    // standard flash
    inputRatePerMillion = 0.1;
    outputRatePerMillion = 0.4;
  }

  const promptCost = (promptTokens / 1_000_000) * inputRatePerMillion;
  const completionCost = (completionTokens / 1_000_000) * outputRatePerMillion;
  return Number((promptCost + completionCost).toFixed(6));
}

/** Get all recorded logs from local storage vault, isolated by user */
export function getStoredApiLogs(userId?: string | null): ApiUsageLog[] {
  if (typeof window === "undefined") return [];
  const key = getApiStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Record a new API log entry to both Supabase and the persistent vault */
export async function recordApiUsageLog(
  entry: Omit<ApiUsageLog, "id" | "total_tokens" | "estimated_cost_usd" | "created_at"> & { id?: string; created_at?: string },
  userId?: string | null
): Promise<ApiUsageLog> {
  const prompt_tokens = Math.max(0, entry.prompt_tokens || 0);
  const completion_tokens = Math.max(0, entry.completion_tokens || 0);
  const total_tokens = prompt_tokens + completion_tokens;
  const cost = calculateTokenCost(prompt_tokens, completion_tokens, entry.model);

  const log: ApiUsageLog = {
    id: entry.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    model: entry.model || "google/gemini-3.1-flash-lite",
    component: entry.component,
    team_id: entry.team_id || null,
    team_name: entry.team_name || null,
    status: entry.status,
    http_status: entry.http_status || (entry.status === "success" ? 200 : 500),
    prompt_tokens,
    completion_tokens,
    total_tokens,
    duration_ms: entry.duration_ms || 450,
    estimated_cost_usd: cost,
    error: entry.error || null,
    created_at: entry.created_at || new Date().toISOString(),
  };

  // 1. Save to local storage vault
  if (typeof window !== "undefined") {
    const key = getApiStorageKey(userId);
    try {
      const current = getStoredApiLogs(userId);
      const updated = [log, ...current].slice(0, 5000); // keep last 5000
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn("Could not save API log to local storage:", e);
    }
  }

  // 2. Try inserting into Supabase
  try {
    await supabase.from("api_usage_logs").insert({
      ...(log.id.startsWith("log-") ? {} : { id: log.id }),
      model: log.model,
      component: log.component,
      ...(log.team_id ? { team_id: log.team_id } : {}),
      status: log.status,
      http_status: log.http_status,
      prompt_tokens: log.prompt_tokens,
      completion_tokens: log.completion_tokens,
      duration_ms: log.duration_ms,
      error: log.error || null,
    });
  } catch (err) {
    // Ignore Supabase connection or RLS errors in dev/fallback
  }

  return log;
}

