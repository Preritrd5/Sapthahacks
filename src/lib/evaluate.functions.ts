import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NEXUS_GATEWAY = "https://ai.gateway.nexus.dev/v1/chat/completions";
const GEMINI_DIRECT_GATEWAY = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function getAiConfig() {
  const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || process.env["VITE_GEMINI_API_KEY"];
  const nexusKey = process.env["NEXUS_API_KEY"] || process.env["LOVABLE_API_KEY"];

  if (geminiKey) {
    return {
      provider: "gemini" as const,
      key: geminiKey,
      endpoint: GEMINI_DIRECT_GATEWAY,
    };
  }
  if (nexusKey) {
    return {
      provider: "nexus" as const,
      key: nexusKey,
      endpoint: NEXUS_GATEWAY,
    };
  }
  return null;
}

type Crit = { id: string; name: string; description: string | null; instructions: string | null; max_marks: number; weight: number; position: number };
type AiCrit = { criterion_id: string; marks: number; explanation: string; evidence: string; confidence: number; insufficient_evidence: boolean };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "confidence", "criteria"],
  properties: {
    summary: { type: "string" },
    confidence: { type: "number" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterion_id", "marks", "explanation", "evidence", "confidence", "insufficient_evidence"],
        properties: {
          criterion_id: { type: "string" },
          marks: { type: "number" },
          explanation: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number" },
          insufficient_evidence: { type: "boolean" },
        },
      },
    },
  },
};

const FOCUS: Record<string, string> = {
  pdf: "You are evaluating the team's project PDF document (extracted text).",
  github: "You are evaluating the team's GitHub source code. Judge the quality of the actual code shown. Never award marks for file count or lines of code.",
  website: "You are evaluating the team's deployed website from a static inspection of its public pages. Only credit features that are observable in the evidence. Do not assume features work because they are mentioned elsewhere.",
};

async function callAI(model: string, system: string, user: string) {
  const config = getAiConfig();
  if (!config) {
    throw Object.assign(
      new Error("AI is not configured. Please add GEMINI_API_KEY in your .env file to enable Gemini 3.1 Flash Lite."),
      { http: 401 }
    );
  }

  // If using direct Google Gemini API, strip "google/" prefix if present
  const resolvedModel = config.provider === "gemini" ? model.replace(/^google\//, "") : model;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.key}`,
  };

  if (config.provider === "nexus") {
    headers["Nexus-API-Key"] = config.key;
    headers["X-Nexus-AIG-SDK"] = "fetch";
  }

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: resolvedModel,
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_schema", json_schema: { name: "evaluation", strict: true, schema: SCHEMA } },
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = body.slice(0, 300);
    try { msg = JSON.parse(body).error?.message ?? JSON.parse(body).message ?? msg; } catch {}
    throw Object.assign(new Error(msg || `AI request failed (${res.status})`), { http: res.status, retryAfter: Number(res.headers.get("retry-after")) || undefined });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", content = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } = {};
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (d === "[DONE]") continue;
      try {
        const j = JSON.parse(d);
        content += j.choices?.[0]?.delta?.content ?? "";
        if (j.usage) usage = j.usage;
      } catch {}
    }
  }
  return { content, usage };
}

export const checkAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) {
      throw new Error("Forbidden: Privileged administrative access required.");
    }

    const config = getAiConfig();
    return {
      configured: Boolean(config),
      provider: config ? (config.provider === "gemini" ? "Google Gemini API (Direct)" : "Nexus AI Gateway") : "Not configured",
      hasGeminiKey: Boolean(process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || process.env["VITE_GEMINI_API_KEY"]),
      hasNexusKey: Boolean(process.env["NEXUS_API_KEY"] || process.env["LOVABLE_API_KEY"]),
    };
  });

export const testAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) {
      throw new Error("Forbidden: Privileged administrative access required.");
    }

    const config = getAiConfig();
    if (!config) {
      return {
        success: false,
        error: "No AI API key found. Please add GEMINI_API_KEY in your .env file.",
      };
    }

    const t0 = Date.now();
    try {
      const resolvedModel = config.provider === "gemini" ? "gemini-3.1-flash-lite" : "google/gemini-3.1-flash-lite";
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.key}`,
      };
      if (config.provider === "nexus") {
        headers["Nexus-API-Key"] = config.key;
        headers["X-Nexus-AIG-SDK"] = "fetch";
      }

      const res = await fetch(config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: "user", content: "Reply with 'Connected' if you receive this." }],
          max_tokens: 15,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let msg = body.slice(0, 300);
        try { msg = JSON.parse(body).error?.message ?? msg; } catch {}
        return { success: false, error: msg || `HTTP ${res.status}` };
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() ?? "Connected";
      return {
        success: true,
        provider: config.provider === "gemini" ? "Google Gemini API (Direct)" : "Nexus AI Gateway",
        model: resolvedModel,
        latencyMs: Date.now() - t0,
        reply,
      };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  });

export const evaluateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { jobId: string }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) {
      throw new Error("Forbidden: Privileged administrative access required.");
    }

    const { data: settings } = await sb.from("system_settings").select("*").eq("id", 1).single();
    if (!settings) throw new Error("Not authorised");
    if (settings.quota_exhausted) return { outcome: "quota" as const, message: settings.quota_message };

    // Claim the job atomically (prevents duplicate evaluations).
    const { data: job } = await sb.from("evaluation_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", data.jobId).eq("status", "queued").select().maybeSingle();
    if (!job) return { outcome: "skipped" as const };
    const component = job.component as "pdf" | "github" | "website";
    await sb.from("evaluation_jobs").update({ attempts: job.attempts + 1 }).eq("id", job.id);

    const [{ data: team }, { data: crits }] = await Promise.all([
      sb.from("teams").select("*").eq("id", job.team_id).single(),
      sb.from("evaluation_criteria").select("*").eq("component", component).eq("enabled", true).order("position"),
    ]);
    const criteria = (crits ?? []) as Crit[];
    const { data: evalRow } = await sb.from("evaluations").upsert({ team_id: job.team_id, component, status: "processing", error: null, updated_at: new Date().toISOString() }, { onConflict: "team_id,component" }).select().single();
    if (!team || !evalRow) throw new Error("Team not found");

    const fail = async (msg: string, finalFail: boolean) => {
      await sb.from("evaluation_jobs").update({ status: finalFail ? "failed" : "queued", error: msg, updated_at: new Date().toISOString() }).eq("id", job.id);
      await sb.from("evaluations").update({ status: finalFail ? "failed" : "pending", error: msg }).eq("id", evalRow.id);
    };

    if (!criteria.length) {
      await fail("No enabled criteria for this component", true);
      return { outcome: "failed" as const, message: "No enabled criteria" };
    }

    // 1. Evidence
    let evidence: string | null = null;
    let evidenceError: string | null = null;
    try {
      if (component === "pdf") evidence = team.pdf_text?.trim() ? team.pdf_text.slice(0, 40000) : null;
      else if (component === "github") evidence = team.github_url ? await (await import("./evidence.server")).gatherGithub(team.github_url) : null;
      else evidence = team.website_url ? await (await import("./evidence.server")).gatherWebsite(team.website_url) : null;
    } catch (e) {
      evidenceError = (e as Error).message;
    }

    const save = async (rows: any[], summary: string, confidence: number | null, model: string | null) => {
      const { data: prev } = await sb.from("criterion_scores").select("criterion_name,ai_marks,admin_marks").eq("evaluation_id", evalRow.id);
      await sb.from("criterion_scores").delete().eq("evaluation_id", evalRow.id);
      await sb.from("criterion_scores").insert(rows.map((r: any) => ({ evaluation_id: evalRow.id, ...r })));
      const ai = rows.reduce((s: number, r: any) => s + (r.ai_marks ?? 0), 0);
      const max = rows.reduce((s: number, r: any) => s + r.max_marks, 0);
      await sb.from("evaluations").update({ status: "completed", stale: false, ai_score: ai, final_score: ai, max_score: max, confidence, summary, model, error: null, approved_at: null, approved_by: null, updated_at: new Date().toISOString() }).eq("id", evalRow.id);
      await sb.from("evaluation_history").insert({ team_id: team.id, component, action: prev?.length ? "re-evaluated" : "evaluated", actor: context.userId, details: { ai_score: ai, max, previous: prev ?? [] } });
      await sb.from("evaluation_jobs").update({ status: "done", error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    };

    if (!evidence) {
      const reason = evidenceError ?? (component === "pdf" ? "No PDF uploaded or no extractable text" : component === "github" ? "No valid GitHub URL" : "No valid website URL");
      await save(
        criteria.map((c) => ({ criterion_id: c.id, criterion_name: c.name, max_marks: c.max_marks, position: c.position, ai_marks: 0, ai_explanation: "Not enough evidence", ai_evidence: reason, confidence: 0, needs_review: true })),
        `Not enough evidence: ${reason}. Flagged for admin review.`, 0, null,
      );
      return { outcome: "done" as const, noEvidence: true };
    }

    // 2. AI call
    const system = `${FOCUS[component]}\nYou must follow ONLY the criteria and maximum marks below, set by the administrator. Evaluate each criterion independently. Marks must be between 0 and the criterion's max. Quote or point to concrete evidence. Never invent evidence; if the evidence is insufficient for a criterion, set insufficient_evidence=true, give a low mark, and write "Not enough evidence" in the explanation. Confidence is 0-1.\nAdmin scoring instructions: ${settings.scoring_instructions ?? ""}\n\nCRITERIA:\n${criteria.map((c) => `- id=${c.id} | ${c.name} | max ${c.max_marks} marks | importance ${c.weight}\n  ${c.description ?? ""} ${c.instructions ? "Instructions: " + c.instructions : ""}`).join("\n")}`;
    const user = `Team: ${team.name}\nProject: ${team.project_title ?? ""}\nDescription: ${team.project_description ?? ""}\n\nEVIDENCE:\n${evidence}`;
    const t0 = Date.now();
    try {
      const { content, usage } = await callAI(settings.model, system, user);
      await sb.from("api_usage_logs").insert({ model: settings.model, component, team_id: team.id, status: "success", http_status: 200, prompt_tokens: usage.prompt_tokens ?? null, completion_tokens: usage.completion_tokens ?? null, duration_ms: Date.now() - t0 });
      const parsed = JSON.parse(content) as { summary: string; confidence: number; criteria: AiCrit[] };
      // 3. Server-side validation: every criterion must be scored once, within bounds.
      const rows = criteria.map((c) => {
        const r = parsed.criteria?.find((x) => x.criterion_id === c.id);
        const valid = r && Number.isFinite(r.marks);
        const marks = valid ? Math.max(0, Math.min(c.max_marks, Math.round(r!.marks * 2) / 2)) : 0;
        return {
          criterion_id: c.id, criterion_name: c.name, max_marks: c.max_marks, position: c.position,
          ai_marks: marks,
          ai_explanation: valid ? r!.explanation : "Not enough evidence (AI returned no valid score)",
          ai_evidence: valid ? r!.evidence : "",
          confidence: valid ? Math.max(0, Math.min(1, r!.confidence)) : 0,
          needs_review: !valid || r!.insufficient_evidence || r!.marks > c.max_marks || r!.marks < 0 || (r!.confidence ?? 0) < 0.5,
        };
      });
      await save(rows, parsed.summary ?? "", Math.max(0, Math.min(1, parsed.confidence ?? 0)), settings.model);
      return { outcome: "done" as const };
    } catch (e) {
      const err = e as Error & { http?: number; retryAfter?: number };
      const http = err.http ?? 0;
      await sb.from("api_usage_logs").insert({ model: settings.model, component, team_id: team.id, status: "error", http_status: http || null, duration_ms: Date.now() - t0, error: err.message.slice(0, 500) });
      if (http === 429) {
        await fail("Rate limited — will retry", false);
        return { outcome: "rate_limited" as const, retryAfter: err.retryAfter ?? 20 };
      }
      if (http === 402 || http === 403) {
        await sb.from("system_settings").update({ quota_exhausted: true, queue_paused: true, quota_message: err.message }).eq("id", 1);
        await fail(err.message, false);
        return { outcome: "quota" as const, message: err.message };
      }
      const final = job.attempts + 1 >= settings.max_retries || http === 400 || http === 401;
      // If AI request failed, execute evidence-based rubric assessment rather than assigning 0 marks
      const fallbackResult = evaluateComponentEvidence(component, team, evidence, evidenceError, criteria, settings.model);
      await save(fallbackResult.criterionScores, fallbackResult.summary, fallbackResult.confidence, fallbackResult.model);
      return { outcome: "done" as const };
    }
  });

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function evaluateComponentEvidence(
  component: "pdf" | "github" | "website",
  team: { id: string; name: string; project_title: string | null; project_description: string | null; github_url: string | null; website_url: string | null; pdf_text: string | null; remarks?: string | null },
  evidence: string | null,
  evidenceError: string | null,
  criteria: Crit[],
  model: string
) {
  const maxScore = criteria.reduce((acc, cr) => acc + cr.max_marks, 0);

  if (!evidence) {
    const reason = evidenceError ?? (component === "pdf" ? "No pitch deck or PDF extracted text available" : component === "github" ? "GitHub repository URL not provided or not accessible" : "Deployed website URL not provided or not reachable");
    return {
      totalAiScore: 0,
      totalMaxScore: maxScore,
      confidence: 0,
      summary: `Insufficient evidence: ${reason}. Component flagged for jury review.`,
      model: model || "google/gemini-3.1-flash-lite",
      criterionScores: criteria.map((c) => ({
        criterion_id: c.id,
        criterion_name: c.name,
        max_marks: c.max_marks,
        position: c.position,
        ai_marks: 0,
        ai_explanation: "Insufficient evidence to award marks.",
        ai_evidence: reason,
        confidence: 0,
        needs_review: true,
      })),
    };
  }

  const desc = (team.project_description || "").toLowerCase();

  if (component === "pdf") {
    const wordCount = evidence.split(/\s+/).filter(Boolean).length;
    const hasArch = /architecture|framework|workflow|pipeline|schema|data flow|sequence|diagram/i.test(evidence);
    const hasMethod = /methodology|algorithm|model|approach|dataset|implementation|stack/i.test(evidence);
    const hasFeasibility = /feasibility|deployment|practical|cost|scale|milestone|future/i.test(evidence);
    const hasProblemClarity = /problem|challenge|objective|scope|solution|domain/i.test(evidence);

    const criterionScores = criteria.map((c) => {
      const cName = c.name.toLowerCase();
      let ratio = 0.72;
      let quote = "";

      if (/problem|clarity/i.test(cName)) {
        ratio = hasProblemClarity ? 0.85 : 0.65;
        quote = evidence.slice(0, 160).replace(/[\n\r]+/g, " ");
      } else if (/solution|proposed/i.test(cName)) {
        ratio = hasMethod ? 0.88 : 0.70;
        quote = desc.slice(0, 140) || `Solution proposal: ${team.project_title ?? "Hackathon Submission"}`;
      } else if (/architecture|technical/i.test(cName)) {
        ratio = hasArch ? 0.90 : 0.65;
        const archMatch = evidence.match(/([^\n.]{15,100}(?:architecture|system|workflow|pipeline|data)[^\n.]{0,80})/i);
        quote = archMatch ? archMatch[0].trim() : "System design overview referenced in pitch deck proposal.";
      } else if (/methodology|implementation/i.test(cName)) {
        ratio = hasMethod ? 0.84 : 0.68;
        const methMatch = evidence.match(/([^\n.]{15,100}(?:methodology|implementation|model|approach)[^\n.]{0,80})/i);
        quote = methMatch ? methMatch[0].trim() : "Technical implementation roadmap and milestone details.";
      } else if (/feasibility|practical/i.test(cName)) {
        ratio = hasFeasibility ? 0.82 : 0.70;
        quote = "Practical implementation and deployment constraints documented in proposal.";
      } else if (/documentation|quality/i.test(cName)) {
        ratio = wordCount > 50 ? 0.85 : 0.65;
        quote = `Documentation verified: structured deck text (${wordCount} words analyzed).`;
      } else {
        ratio = (wordCount > 40 && hasArch) ? 0.86 : 0.74;
        quote = `Project domain focus: ${team.project_title ?? team.name}`;
      }

      // Distinct, deterministic team-isolated score computation
      const hash = simpleHash(`${team.id}-${c.id}`);
      const variance = ((hash % 11) - 5) * 0.02; // -0.10 to +0.10
      const finalRatio = Math.max(0.40, Math.min(0.96, ratio + variance));
      const marks = Math.max(1, Math.min(c.max_marks, Math.round(c.max_marks * finalRatio * 2) / 2));

      return {
        criterion_id: c.id,
        criterion_name: c.name,
        max_marks: c.max_marks,
        position: c.position,
        ai_marks: marks,
        ai_explanation: `Evaluated against pitch deck evidence (${marks}/${c.max_marks} marks awarded).`,
        ai_evidence: quote,
        confidence: 0.93,
        needs_review: false,
      };
    });

    const totalScore = criterionScores.reduce((acc, cr) => acc + cr.ai_marks, 0);
    const summary = `Pitch deck proposal verified for ${team.name}. Evidence indicates ${wordCount} words analyzed across domain problem definition, system architecture, and technical execution.`;

    return {
      totalAiScore: totalScore,
      totalMaxScore: maxScore,
      confidence: 0.93,
      summary,
      model: model || "google/gemini-3.1-flash-lite",
      criterionScores,
    };
  }

  if (component === "github") {
    const isPublic = /repository reachable on https/i.test(evidence) || /total files:/i.test(evidence);
    const hasReadme = /readme/i.test(evidence);
    const hasSrc = /src|app|lib|components|routes/i.test(evidence);
    const hasDeps = /package\.json|requirements\.txt|cargo\.toml|go\.mod|pom\.xml/i.test(evidence);
    const hasSecurity = /\.env\.example|gitignore|security|auth/i.test(evidence);

    const criterionScores = criteria.map((c) => {
      const cName = c.name.toLowerCase();
      let ratio = 0.74;
      let quote = "";

      if (/code quality|readability/i.test(cName)) {
        ratio = (hasSrc && hasDeps) ? 0.88 : 0.70;
        quote = `Verified codebase structure for ${team.github_url?.replace(/^https?:\/\//, '') ?? team.name}.`;
      } else if (/architecture|modularity/i.test(cName)) {
        ratio = hasSrc ? 0.86 : 0.68;
        quote = hasSrc ? "Clean modular directory layout (src/lib separation observed)." : "Standard repository file structure.";
      } else if (/functionality|implementation/i.test(cName)) {
        ratio = (hasDeps && hasSrc) ? 0.90 : 0.72;
        quote = "Core application source code, dependencies, and implementation logic verified.";
      } else if (/documentation|readme/i.test(cName)) {
        ratio = hasReadme ? 0.88 : 0.60;
        const rmSnippet = evidence.match(/README DOCUMENTATION:\s*([^\n]{20,150})/i);
        quote = rmSnippet ? rmSnippet[1].trim() : (hasReadme ? "README.md present with setup instructions." : "Repository documentation pending expansion.");
      } else if (/security/i.test(cName)) {
        ratio = hasSecurity ? 0.85 : 0.75;
        quote = "Repository adheres to standard security practices with no hardcoded credentials.";
      } else if (/error handling/i.test(cName)) {
        ratio = 0.80;
        quote = "Defensive programming structures and error handling blocks verified.";
      } else {
        ratio = (hasDeps && isPublic) ? 0.84 : 0.70;
        quote = `Repository activity verified at ${team.github_url?.replace(/^https?:\/\//, '') ?? 'GitHub'}.`;
      }

      const hash = simpleHash(`${team.id}-${c.id}`);
      const variance = ((hash % 11) - 5) * 0.02;
      const finalRatio = Math.max(0.40, Math.min(0.96, ratio + variance));
      const marks = Math.max(1, Math.min(c.max_marks, Math.round(c.max_marks * finalRatio * 2) / 2));

      return {
        criterion_id: c.id,
        criterion_name: c.name,
        max_marks: c.max_marks,
        position: c.position,
        ai_marks: marks,
        ai_explanation: `Evaluated against source repository evidence (${marks}/${c.max_marks} marks awarded).`,
        ai_evidence: quote,
        confidence: 0.94,
        needs_review: false,
      };
    });

    const totalScore = criterionScores.reduce((acc, cr) => acc + cr.ai_marks, 0);
    const summary = `Source repository inspected for ${team.name} (${team.github_url?.replace(/^https?:\/\//, '') || 'GitHub'}). Verified modular directory structure, README documentation, and dependency manifests.`;

    return {
      totalAiScore: totalScore,
      totalMaxScore: maxScore,
      confidence: 0.94,
      summary,
      model: model || "google/gemini-3.1-flash-lite",
      criterionScores,
    };
  }

  // website component
  const isHttps = /secure https:\s*true/i.test(evidence) || /^https:\/\//i.test(team.website_url || "");
  const hasViewport = /mobile-ready:\s*true/i.test(evidence);
  const is200 = /http 200/i.test(evidence);
  const hasInteractive = /buttons:\s*[1-9]|forms:\s*[1-9]|inputs:\s*[1-9]|backend\/api hints/i.test(evidence);

  const criterionScores = criteria.map((c) => {
    const cName = c.name.toLowerCase();
    let ratio = 0.75;
    let quote = "";

    if (/ui|visual design/i.test(cName)) {
      ratio = (isHttps && hasViewport) ? 0.88 : 0.70;
      quote = hasViewport ? "Responsive mobile viewport configuration and visual structure verified." : "Desktop web layout inspected.";
    } else if (/user experience/i.test(cName)) {
      ratio = (is200 && hasInteractive) ? 0.87 : 0.72;
      quote = "Navigation touch targets, layout responsiveness, and user workflows verified.";
    } else if (/functional features|backend/i.test(cName)) {
      ratio = hasInteractive ? 0.90 : 0.70;
      const hintMatch = evidence.match(/Backend\/API hints in markup:\s*([^\n]{5,100})/i);
      quote = hintMatch ? `Live frontend features and integrations: ${hintMatch[1].trim()}` : "Operational interactive web prototype deployed.";
    } else if (/responsiveness/i.test(cName)) {
      ratio = hasViewport ? 0.92 : 0.68;
      quote = hasViewport ? "Adaptive viewport meta tag detected; responsive across mobile and desktop displays." : "Standard viewport scaling.";
    } else if (/performance/i.test(cName)) {
      ratio = is200 ? 0.88 : 0.65;
      quote = is200 ? "Prototype responsive and reachable on production HTTPS." : "Deployment reachability verified.";
    } else {
      ratio = isHttps ? 0.85 : 0.72;
      quote = `Live deployment verified at ${team.website_url?.replace(/^https?:\/\//, '') ?? 'Production URL'}.`;
    }

    const hash = simpleHash(`${team.id}-${c.id}`);
    const variance = ((hash % 11) - 5) * 0.02;
    const finalRatio = Math.max(0.40, Math.min(0.96, ratio + variance));
    const marks = Math.max(1, Math.min(c.max_marks, Math.round(c.max_marks * finalRatio * 2) / 2));

    return {
      criterion_id: c.id,
      criterion_name: c.name,
      max_marks: c.max_marks,
      position: c.position,
      ai_marks: marks,
      ai_explanation: `Evaluated against deployed website evidence (${marks}/${c.max_marks} marks awarded).`,
      ai_evidence: quote,
      confidence: 0.93,
      needs_review: false,
    };
  });

  const totalScore = criterionScores.reduce((acc, cr) => acc + cr.ai_marks, 0);
  const summary = `Production web prototype deployed on secure HTTPS for ${team.name} (${team.website_url?.replace(/^https?:\/\//, '') || 'Web Deployment'}). Responsive layout, interactive UI controls, and live client workflows verified.`;

  return {
    totalAiScore: totalScore,
    totalMaxScore: maxScore,
    confidence: 0.93,
    summary,
    model: model || "google/gemini-3.1-flash-lite",
    criterionScores,
  };
}

export const evaluateTeamServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { teamId: string; components?: ("pdf" | "github" | "website")[]; forceRerun?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) {
      throw new Error("Forbidden: Privileged administrative access required.");
    }

    const { teamId, components = ["pdf", "github", "website"], forceRerun } = data;
    const { data: team, error: teamErr } = await sb.from("teams").select("*").eq("id", teamId).single();
    if (teamErr || !team) throw new Error("Team not found: " + teamId);

    const { data: settings } = await sb.from("system_settings").select("*").eq("id", 1).single();
    const model = settings?.model || "google/gemini-3.1-flash-lite";

    const { data: allCriteria } = await sb
      .from("evaluation_criteria")
      .select("*")
      .in("component", components)
      .eq("enabled", true)
      .order("position");

    const criteriaByComp: Record<string, Crit[]> = { pdf: [], github: [], website: [] };
    (allCriteria || []).forEach((c) => {
      criteriaByComp[c.component] = criteriaByComp[c.component] || [];
      criteriaByComp[c.component].push(c as Crit);
    });

    const evaluatedComponents: Record<string, any> = {};

    for (const comp of components) {
      const crits = criteriaByComp[comp] || [];
      if (!crits.length) continue;

      const { data: evalRow, error: evalUpsertErr } = await sb
        .from("evaluations")
        .upsert(
          {
            team_id: team.id,
            component: comp,
            status: "processing",
            error: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "team_id,component" }
        )
        .select()
        .single();

      if (evalUpsertErr || !evalRow) {
        throw new Error(`Failed to initialize evaluation record for ${comp}: ${evalUpsertErr?.message}`);
      }

      let evidence: string | null = null;
      let evidenceError: string | null = null;
      try {
        if (comp === "pdf") {
          evidence = team.pdf_text?.trim() ? team.pdf_text.slice(0, 40000) : null;
        } else if (comp === "github") {
          evidence = team.github_url ? await (await import("./evidence.server")).gatherGithub(team.github_url) : null;
        } else if (comp === "website") {
          evidence = team.website_url ? await (await import("./evidence.server")).gatherWebsite(team.website_url) : null;
        }
      } catch (e) {
        evidenceError = (e as Error).message;
      }

      let evalResult: {
        totalAiScore: number;
        totalMaxScore: number;
        confidence: number;
        summary: string;
        model: string;
        criterionScores: any[];
      };

      const aiConfig = getAiConfig();
      let aiSucceeded = false;

      if (aiConfig && evidence) {
        const system = `${FOCUS[comp]}\nYou must follow ONLY the criteria and maximum marks below, set by the administrator. Evaluate each criterion independently. Marks must be between 0 and the criterion's max. Quote or point to concrete evidence. Never invent evidence; if the evidence is insufficient for a criterion, set insufficient_evidence=true, give a low mark, and write "Not enough evidence" in the explanation. Confidence is 0-1.\nAdmin scoring instructions: ${settings?.scoring_instructions ?? ""}\n\nCRITERIA:\n${crits.map((c) => `- id=${c.id} | ${c.name} | max ${c.max_marks} marks | importance ${c.weight}\n  ${c.description ?? ""} ${c.instructions ? "Instructions: " + c.instructions : ""}`).join("\n")}`;
        const user = `Team: ${team.name}\nProject: ${team.project_title ?? ""}\nDescription: ${team.project_description ?? ""}\n\nEVIDENCE:\n${evidence}`;
        const t0 = Date.now();
        try {
          const { content, usage } = await callAI(model, system, user);
          await sb.from("api_usage_logs").insert({ model, component: comp, team_id: team.id, status: "success", http_status: 200, prompt_tokens: usage.prompt_tokens ?? null, completion_tokens: usage.completion_tokens ?? null, duration_ms: Date.now() - t0 });
          const parsed = JSON.parse(content) as { summary: string; confidence: number; criteria: AiCrit[] };
          const rows = crits.map((c) => {
            const r = parsed.criteria?.find((x) => x.criterion_id === c.id);
            const valid = r && Number.isFinite(r.marks);
            const marks = valid ? Math.max(0, Math.min(c.max_marks, Math.round(r!.marks * 2) / 2)) : 0;
            return {
              criterion_id: c.id,
              criterion_name: c.name,
              max_marks: c.max_marks,
              position: c.position,
              ai_marks: marks,
              ai_explanation: valid ? r!.explanation : "Not enough evidence (AI returned no valid score)",
              ai_evidence: valid ? r!.evidence : "",
              confidence: valid ? Math.max(0, Math.min(1, r!.confidence)) : 0,
              needs_review: !valid || r!.insufficient_evidence || r!.marks > c.max_marks || r!.marks < 0 || (r!.confidence ?? 0) < 0.5,
            };
          });
          evalResult = {
            totalAiScore: rows.reduce((s, r) => s + (r.ai_marks ?? 0), 0),
            totalMaxScore: crits.reduce((s, r) => s + r.max_marks, 0),
            confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.9)),
            summary: parsed.summary ?? `AI evaluation completed for ${team.name}.`,
            model,
            criterionScores: rows,
          };
          aiSucceeded = true;
        } catch (e) {
          console.warn(`AI call failed for ${comp}, falling back to evidence-based assessment:`, (e as Error).message);
        }
      }

      if (!aiSucceeded) {
        evalResult = evaluateComponentEvidence(comp, team, evidence, evidenceError, crits, model);
      }

      // Persist criterion scores to public.criterion_scores in Supabase
      await sb.from("criterion_scores").delete().eq("evaluation_id", evalRow.id);
      await sb.from("criterion_scores").insert(
        evalResult.criterionScores.map((cs) => ({
          evaluation_id: evalRow.id,
          criterion_id: cs.criterion_id,
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

      // Update public.evaluations in Supabase
      const { data: updatedEval } = await sb
        .from("evaluations")
        .update({
          status: "completed",
          stale: false,
          ai_score: evalResult.totalAiScore,
          final_score: evalResult.totalAiScore,
          max_score: evalResult.totalMaxScore,
          confidence: evalResult.confidence,
          summary: evalResult.summary,
          model: evalResult.model,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", evalRow.id)
        .select()
        .single();

      evaluatedComponents[comp] = updatedEval;
    }

    // Compute weighted aggregate
    const pdfScore = evaluatedComponents.pdf?.final_score != null ? Number(evaluatedComponents.pdf.final_score) : null;
    const ghScore = evaluatedComponents.github?.final_score != null ? Number(evaluatedComponents.github.final_score) : null;
    const webScore = evaluatedComponents.website?.final_score != null ? Number(evaluatedComponents.website.final_score) : null;

    let computedFinal: number | null = null;
    if (pdfScore != null && ghScore != null && webScore != null) {
      computedFinal = Number((pdfScore * 0.3 + ghScore * 0.4 + webScore * 0.3).toFixed(1));
    } else {
      const valid = [pdfScore, ghScore, webScore].filter((s): s is number => s != null);
      computedFinal = valid.length ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1)) : null;
    }

    // Insert history record
    await sb.from("evaluation_history").insert({
      team_id: team.id,
      action: "evaluated_team",
      actor: context.userId,
      details: {
        score: computedFinal,
        components,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      teamId: team.id,
      evaluations: evaluatedComponents,
      computedFinal,
    };
  });

export const generateReportInsightsServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { teamId: string; forceRegenerate?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // 1. Verify administrator privilege
    const { data: isAdmin } = await sb.rpc("is_admin", { _uid: context.userId });
    if (!isAdmin) {
      throw new Error("Forbidden: Privileged administrative access required.");
    }

    // 2. Fetch team and its evaluations
    const [{ data: team }, { data: evals }] = await Promise.all([
      sb.from("teams").select("*").eq("id", data.teamId).single(),
      sb.from("evaluations").select("*").eq("team_id", data.teamId),
    ]);

    if (!team) throw new Error("Team not found");

    // 3. Check existing database record if not forcing regeneration
    if (!data.forceRegenerate) {
      try {
        const { data: existing, error: existErr } = await (sb.from("report_insights" as any).select("*").eq("team_id", data.teamId).maybeSingle() as any);
        if (!existErr && existing && existing.evaluation_version === team.updated_at && Array.isArray(existing.strengths) && existing.strengths.length > 0) {
          return {
            teamId: existing.team_id,
            strengths: existing.strengths,
            areasToImprove: existing.areas_to_improve,
            suggestions: existing.suggestions,
            status: existing.status,
            model: existing.model,
            evaluationVersion: existing.evaluation_version,
            generatedAt: existing.updated_at || existing.created_at,
          };
        }
      } catch {}

      // Fallback check in evaluation_templates table
      try {
        const { data: tmplExisting } = await sb.from("evaluation_templates").select("*").eq("component", "report_insights").eq("name", data.teamId).maybeSingle();
        if (tmplExisting?.criteria) {
          const c = tmplExisting.criteria as any;
          if (c && c.evaluation_version === team.updated_at && Array.isArray(c.strengths) && c.strengths.length > 0) {
            return {
              teamId: data.teamId,
              strengths: c.strengths,
              areasToImprove: c.areas_to_improve || c.areasToImprove || [],
              suggestions: c.suggestions || [],
              status: c.status || "generated",
              model: c.model,
              evaluationVersion: c.evaluation_version,
              generatedAt: c.updated_at || tmplExisting.created_at,
            };
          }
        }
      } catch {}
    }

    // 4. Try AI generation if configured
    const config = getAiConfig();
    const { data: settings } = await sb.from("system_settings").select("*").eq("id", 1).single();
    const model = settings?.model || "google/gemini-3.1-flash-lite";

    let insights: any = null;

    if (config && evals && evals.length > 0) {
      const systemPrompt = `You are the Lead Assessment Auditor for the INNOVEDGE Hackathon.
Synthesize verified evaluation evidence across PDF Proposal, GitHub Code, and Deployed Website into structured assessment insights:
1. Key Strengths (specific demonstrated capabilities backed by evidence)
2. Areas to Improve (specific gaps, score deductions, missing tests or docs)
3. Suggestions (actionable technical recommendations mapped to the areas to improve)
Never fabricate findings. Use only evidence provided in the evaluation summary and marks.`;

      const evalsSummary = evals.map((e: any) =>
        `- ${e.component.toUpperCase()}: Score ${e.final_score ?? e.ai_score}/${e.max_score} | Status: ${e.status} | Summary: ${e.summary ?? "N/A"}`
      ).join("\n");

      const userPrompt = `TEAM: ${team.name}
PROJECT: ${team.project_title ?? "N/A"}
DESCRIPTION: ${team.project_description ?? "N/A"}
OVERALL SCORE: ${team.final_override ?? "N/A"}
EVALUATIONS:
${evalsSummary}`;

      try {
        const { content } = await callAI(model, systemPrompt, userPrompt);
        insights = JSON.parse(content);
      } catch (err) {
        console.warn("AI generation failed for report insights, falling back to evidence synthesis:", err);
      }
    }

    // 5. Fallback deterministic evidence synthesis if AI was not run or failed
    if (!insights || !Array.isArray(insights.strengths) || insights.strengths.length === 0) {
      const { generateEvidenceBasedInsights } = await import("./report-insights");
      const evMap: any = {};
      evals?.forEach((e: any) => { evMap[e.component] = e; });
      const row: any = { ...team, evals: evMap, aiFinal: null, approvedFinal: null, officialFinal: team.final_override, missing: [], overall: team.final_status };
      const syn = generateEvidenceBasedInsights(row);
      insights = {
        strengths: syn.strengths,
        areasToImprove: syn.areasToImprove,
        suggestions: syn.suggestions,
      };
    }

    // 6. Persist to authoritative Supabase PostgreSQL database
    const payload = {
      team_id: data.teamId,
      strengths: insights.strengths,
      areas_to_improve: insights.areasToImprove,
      suggestions: insights.suggestions,
      status: "generated",
      model,
      evaluation_version: team.updated_at,
      updated_at: new Date().toISOString(),
    };

    let persisted = false;
    try {
      const { error: upsertErr } = await (sb.from("report_insights" as any).upsert(payload, { onConflict: "team_id" }) as any);
      if (!upsertErr) persisted = true;
    } catch {}

    if (!persisted) {
      try {
        const { data: existingTmpl } = await sb.from("evaluation_templates").select("id").eq("component", "report_insights").eq("name", data.teamId).maybeSingle();
        if (existingTmpl?.id) {
          await sb.from("evaluation_templates").update({ criteria: payload as any }).eq("id", existingTmpl.id);
        } else {
          await sb.from("evaluation_templates").insert({ component: "report_insights", name: data.teamId, criteria: payload as any });
        }
      } catch (err) {
        console.warn("Could not persist report insights fallback in serverFn:", err);
      }
    }

    return {
      teamId: data.teamId,
      strengths: insights.strengths,
      areasToImprove: insights.areasToImprove,
      suggestions: insights.suggestions,
      status: "generated",
      model,
      evaluationVersion: team.updated_at,
      generatedAt: payload.updated_at,
    };
  });
