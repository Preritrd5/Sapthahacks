import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Save,
  Trash2,
  FolderOpen,
  Sparkles,
  RotateCcw,
  FileText,
  Github,
  Globe,
  Layers,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-primitives";
import { COMPONENTS, COMPONENT_LABEL, type Component } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import type { Tables } from "@/integrations/supabase/types";

type Crit = Tables<"evaluation_criteria">;

export const DEFAULT_CRITERIA_MAP: Record<Component, Crit[]> = {
  pdf: [
    {
      id: "pdf-1",
      component: "pdf",
      name: "Problem Statement Clarity",
      max_marks: 10,
      position: 1,
      enabled: true,
      weight: 1,
      description: "Evaluates how clearly the team identifies, articulates, and frames the real-world problem, target users, domain constraints, and baseline pain points.",
      instructions: "Inspect the introduction, problem definition, and background sections. Deduct marks if the problem scope is ambiguous, lacks real-world relevance, or fails to define target beneficiaries.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-2",
      component: "pdf",
      name: "Proposed Solution",
      max_marks: 15,
      position: 2,
      enabled: true,
      weight: 1,
      description: "Evaluates the coherence, logical formulation, and completeness of the proposed system or approach solving the problem.",
      instructions: "Examine the solution overview, workflow diagrams, and feature design. Check if the proposed approach directly solves the stated problem constraints rather than just generic ideas.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-3",
      component: "pdf",
      name: "Innovation and Uniqueness",
      max_marks: 15,
      position: 3,
      enabled: true,
      weight: 1,
      description: "Assesses originality, novel algorithms, creative problem-solving, and differentiation from existing off-the-shelf commercial solutions.",
      instructions: "Identify comparative novelty, competitive differentiators, or proprietary algorithms. Flag generic boilerplate or standard tutorials.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-4",
      component: "pdf",
      name: "Technical Architecture",
      max_marks: 15,
      position: 4,
      enabled: true,
      weight: 1,
      description: "Analyzes system architecture, component decomposition, data ingestion flow, scalability, and integration protocols.",
      instructions: "Evaluate architectural block diagrams, microservice boundaries, database schemata, and latency/throughput considerations.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-5",
      component: "pdf",
      name: "Methodology and Implementation",
      max_marks: 15,
      position: 5,
      enabled: true,
      weight: 1,
      description: "Assesses the engineering execution plan, experimental setup, tools/frameworks chosen, and empirical validation metrics.",
      instructions: "Check technical feasibility of chosen tech stack, milestone breakdown, testing methodology, and benchmarking metrics.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-6",
      component: "pdf",
      name: "Feasibility and Practicality",
      max_marks: 10,
      position: 6,
      enabled: true,
      weight: 1,
      description: "Evaluates economic viability, hardware/cloud infrastructure requirements, operational constraints, and deployment feasibility.",
      instructions: "Analyze computational complexity, estimated cloud costs, hardware dependencies, and real-world adoption barriers.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-7",
      component: "pdf",
      name: "Documentation Quality",
      max_marks: 10,
      position: 7,
      enabled: true,
      weight: 1,
      description: "Reviews document visual polish, typography, structural clarity, citations, charts, and overall professional presentation.",
      instructions: "Check formatting consistency, readability of diagrams and tables, executive summary clarity, and proper technical references.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "pdf-8",
      component: "pdf",
      name: "Expected Impact",
      max_marks: 10,
      position: 8,
      enabled: true,
      weight: 1,
      description: "Evaluates quantifiable social, environmental, commercial, or institutional benefits and user impact projections.",
      instructions: "Verify whether projected metrics, ROI, or societal outcomes are realistically grounded with verifiable impact indicators.",
      updated_at: new Date().toISOString(),
    },
  ],
  github: [
    {
      id: "gh-1",
      component: "github",
      name: "Code Quality and Readability",
      max_marks: 15,
      position: 1,
      enabled: true,
      weight: 1,
      description: "Evaluates code cleanliness, idiomatic conventions, naming clarity, type safety, and linting compliance.",
      instructions: "Check consistency of naming, absence of dead/commented code, proper indentation, and adherence to clean coding principles.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-2",
      component: "github",
      name: "Project Architecture",
      max_marks: 15,
      position: 2,
      enabled: true,
      weight: 1,
      description: "Assesses structural design, modular separation of concerns between presentation, business logic, and persistence layers.",
      instructions: "Verify folder layout, dependency injection patterns, decoupling of modules, and clear API boundaries.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-3",
      component: "github",
      name: "Functionality and Implementation",
      max_marks: 20,
      position: 3,
      enabled: true,
      weight: 1,
      description: "Evaluates the depth and completeness of the core functional logic, algorithms, and demonstrable working features.",
      instructions: "Verify that core algorithms are genuinely implemented and operational, not just mock return stubs or empty placeholders.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-4",
      component: "github",
      name: "Code Organisation and Modularity",
      max_marks: 10,
      position: 4,
      enabled: true,
      weight: 1,
      description: "Analyzes reusability, modular abstraction, custom hooks/utilities, and elimination of duplicated code (DRY).",
      instructions: "Check for shared reusable libraries, atomic components, utility helpers, and minimal code duplication.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-5",
      component: "github",
      name: "Error Handling",
      max_marks: 10,
      position: 5,
      enabled: true,
      weight: 1,
      description: "Evaluates defensive programming, exception handling, fallback states, input validation, and boundary protection.",
      instructions: "Inspect try-catch blocks, graceful error recoveries, input sanitization, and user-facing error feedback.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-6",
      component: "github",
      name: "Security Practices",
      max_marks: 10,
      position: 6,
      enabled: true,
      weight: 1,
      description: "Assesses security posture: no hardcoded API keys or credentials, safe data handling, and secure authentication flow.",
      instructions: "Audit repository for exposed secrets, unvalidated external payloads, SQL injections, or insecure cryptographic calls.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-7",
      component: "github",
      name: "Technical Complexity",
      max_marks: 10,
      position: 7,
      enabled: true,
      weight: 1,
      description: "Evaluates the depth of non-trivial engineering problems solved (e.g. concurrency, state synchronization, caching, or custom algorithms).",
      instructions: "Distinguish basic CRUD templates from advanced engineering logic, distributed patterns, or sophisticated domain algorithms.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "gh-8",
      component: "github",
      name: "Documentation and README",
      max_marks: 10,
      position: 8,
      enabled: true,
      weight: 1,
      description: "Reviews setup instructions, prerequisites, architecture guides, environment configuration, and demo instructions.",
      instructions: "Check README for clear installation steps, dependency requirements, API documentation, screenshots, and live demo links.",
      updated_at: new Date().toISOString(),
    },
  ],
  website: [
    {
      id: "web-1",
      component: "website",
      name: "UI and Visual Design",
      max_marks: 15,
      position: 1,
      enabled: true,
      weight: 1,
      description: "Evaluates aesthetic appeal, visual hierarchy, harmonious color palette, typography scaling, and clean whitespace.",
      instructions: "Check design consistency, visual contrast, modern UI aesthetics, and absence of visual clutter or overlapping elements.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-2",
      component: "website",
      name: "User Experience",
      max_marks: 15,
      position: 2,
      enabled: true,
      weight: 1,
      description: "Assesses intuitive task completion, accessible touch targets, natural navigation flow, and informative user feedback.",
      instructions: "Test primary user journeys, interactive buttons, form input states, and transition animations for friction.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-3",
      component: "website",
      name: "Functional Features",
      max_marks: 20,
      position: 3,
      enabled: true,
      weight: 1,
      description: "Evaluates the interactive capabilities of the live prototype, form submissions, real-time updates, and state management.",
      instructions: "Verify that interactive UI controls trigger actual behavior rather than non-functional static mockups.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-4",
      component: "website",
      name: "Responsiveness",
      max_marks: 10,
      position: 4,
      enabled: true,
      weight: 1,
      description: "Assesses adaptive layout across mobile, tablet, and desktop viewports with fluid breakpoints and touch ergonomics.",
      instructions: "Test UI on 375px mobile, 768px tablet, and 1440px desktop viewports. Check for horizontal overflow or broken wrapping.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-5",
      component: "website",
      name: "Navigation",
      max_marks: 10,
      position: 5,
      enabled: true,
      weight: 1,
      description: "Evaluates routing logic, header nav, drawer menus, breadcrumbs, and 404/fallback routing.",
      instructions: "Verify internal links, deep linking, active route indicators, and clear back/home navigation options.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-6",
      component: "website",
      name: "Backend and API Integration Evidence",
      max_marks: 10,
      position: 6,
      enabled: true,
      weight: 1,
      description: "Checks dynamic data communication, asynchronous request handling, optimistic loading spinners, and network error toasts.",
      instructions: "Inspect network traffic or UI rendering for dynamic data fetching, loading skeletons, and real-time backend updates.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-7",
      component: "website",
      name: "Performance and Reliability",
      max_marks: 10,
      position: 7,
      enabled: true,
      weight: 1,
      description: "Evaluates page load speed, asset optimization, zero layout shift (CLS), and console error hygiene.",
      instructions: "Check bundle loading performance, image compression, absence of unhandled JavaScript errors in the browser console.",
      updated_at: new Date().toISOString(),
    },
    {
      id: "web-8",
      component: "website",
      name: "Innovation and Overall Experience",
      max_marks: 10,
      position: 8,
      enabled: true,
      weight: 1,
      description: "Assesses overall delight, polish, micro-interactions, unique features, and memorable user impressions.",
      instructions: "Evaluate creative touches, smooth micro-interactions, dark/light theme execution, and distinctive value proposition.",
      updated_at: new Date().toISOString(),
    },
  ],
};

export const Route = createFileRoute("/_authenticated/criteria")({
  validateSearch: (s: Record<string, unknown>): { c?: Component | undefined } => ({ c: COMPONENTS.includes(s["c"] as Component) ? (s["c"] as Component) : undefined }),
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Evaluation criteria — Assessor" }, { name: "description", content: "Manage PDF, GitHub and website criteria." }, { property: "og:title", content: "Evaluation criteria — Assessor" }, { property: "og:description", content: "Manage PDF, GitHub and website criteria." }] }),
  component: Criteria,
});

function Criteria() {
  const { c = "pdf" } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const crits = useQuery({
    queryKey: ["criteria", c],
    queryFn: async () => {
      let result = DEFAULT_CRITERIA_MAP[c];
      try {
        const { data, error } = await supabase
          .from("evaluation_criteria")
          .select("*")
          .eq("component", c)
          .order("position");
        if (!error && data && data.length > 0) result = data;
      } catch {}

      const raw = typeof window !== "undefined" ? localStorage.getItem(`innovedge_criteria_${c}`) : null;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) result = parsed;
        } catch {}
      }

      // Automatically merge detailed descriptions and instructions if empty
      const defaults = DEFAULT_CRITERIA_MAP[c];
      return result.map((item, idx) => {
        const d = defaults.find((def) => def.name.toLowerCase() === item.name.toLowerCase()) || defaults[idx];
        return {
          ...item,
          description: item.description || d?.description || null,
          instructions: item.instructions || d?.instructions || null,
        };
      });
    },
  });
  const templates = useQuery({ queryKey: ["templates", c], queryFn: async () => (await supabase.from("evaluation_templates").select("*").eq("component", c).order("created_at", { ascending: false })).data ?? [] });
  const list = crits.data ?? [];
  const total = list.filter((x) => x.enabled).reduce((s, x) => s + Number(x.max_marks), 0);
  const refresh = () => qc.invalidateQueries();

  const saveToLocal = (items: Crit[]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`innovedge_criteria_${c}`, JSON.stringify(items));
    }
  };

  const populateAllComponentsDefaults = async () => {
    if (!confirm("Populate all official detailed descriptions and instructions across PDF, GitHub, and Website?")) return;
    for (const comp of COMPONENTS) {
      const defs = DEFAULT_CRITERIA_MAP[comp];
      if (typeof window !== "undefined") {
        localStorage.setItem(`innovedge_criteria_${comp}`, JSON.stringify(defs));
      }
      try {
        for (const crit of defs) {
          await supabase.from("evaluation_criteria").upsert({
            id: crit.id,
            component: comp,
            name: crit.name,
            max_marks: crit.max_marks,
            position: crit.position,
            enabled: crit.enabled,
            weight: crit.weight,
            description: crit.description,
            instructions: crit.instructions,
            updated_at: new Date().toISOString(),
          });
        }
      } catch {}
    }
    toast.success("Successfully populated all detailed descriptions across all components!");
    refresh();
  };

  const update = async (id: string, patch: Partial<Crit>) => {
    const updated = list.map((item) => (item.id === id ? { ...item, ...patch, updated_at: new Date().toISOString() } : item));
    saveToLocal(updated);
    try {
      await supabase.from("evaluation_criteria").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    } catch {}
    refresh();
  };
  const add = async () => {
    const newCrit: Crit = {
      id: `crit-${c}-${Date.now()}`,
      component: c,
      name: "New criterion",
      max_marks: 10,
      position: (list.at(-1)?.position ?? 0) + 1,
      enabled: true,
      weight: 1,
      description: null,
      instructions: null,
      updated_at: new Date().toISOString(),
    };
    const updated = [...list, newCrit];
    saveToLocal(updated);
    try {
      await supabase.from("evaluation_criteria").insert({ component: c, name: "New criterion", max_marks: 10, position: newCrit.position });
      await logActivity("Added criterion", COMPONENT_LABEL[c]);
    } catch {}
    refresh();
  };
  const remove = async (x: Crit) => {
    if (!confirm(`Delete "${x.name}"? Existing evaluations keep their scores but will be flagged for re-evaluation.`)) return;
    const updated = list.filter((item) => item.id !== x.id);
    saveToLocal(updated);
    try {
      await supabase.from("evaluation_criteria").delete().eq("id", x.id);
      await logActivity("Deleted criterion", `${COMPONENT_LABEL[c]} · ${x.name}`);
    } catch {}
    refresh();
  };
  const move = async (i: number, d: -1 | 1) => {
    const a = list[i], b = list[i + d];
    if (!a || !b) return;
    const updated = [...list];
    updated[i] = { ...b, position: a.position };
    updated[i + d] = { ...a, position: b.position };
    saveToLocal(updated);
    try {
      await Promise.all([supabase.from("evaluation_criteria").update({ position: b.position }).eq("id", a.id), supabase.from("evaluation_criteria").update({ position: a.position }).eq("id", b.id)]);
    } catch {}
    refresh();
  };
  const saveTemplate = async () => {
    const name = prompt("Template name");
    if (!name) return;
    await supabase.from("evaluation_templates").insert({ component: c, name, criteria: list.map(({ name, description, instructions, max_marks, weight, enabled }) => ({ name, description, instructions, max_marks, weight, enabled })) });
    toast.success("Template saved");
    refresh();
  };
  const applyTemplate = async (t: Tables<"evaluation_templates">) => {
    if (!confirm(`Replace all ${COMPONENT_LABEL[c]} criteria with "${t.name}"? Existing evaluations will be flagged for re-evaluation.`)) return;
    await supabase.from("evaluation_criteria").delete().eq("component", c);
    await supabase.from("evaluation_criteria").insert((t.criteria as any[]).map((x, i) => ({ ...x, component: c, position: i + 1 })));
    await logActivity("Applied template", `${COMPONENT_LABEL[c]} · ${t.name}`);
    refresh();
  };

  const componentWeights = { pdf: 30, github: 40, website: 30 };
  const componentIcons = { pdf: FileText, github: Github, website: Globe };
  const componentGlows: Record<Component, "rose" | "sky" | "emerald"> = {
    pdf: "rose",
    github: "sky",
    website: "emerald",
  };

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Evaluation Criteria Rubric"
          desc="Configure multi-modal grading rubrics, scoring bounds, and explicit evaluation guidance for the AI engine."
        >
          <Button
            variant="outline"
            onClick={populateAllComponentsDefaults}
            className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 font-bold transition-all hover:scale-105"
          >
            <Sparkles className="size-4" /> Fill All Default Descriptions
          </Button>
          <Button variant="secondary" onClick={saveTemplate} className="transition-all hover:scale-105">
            <Save className="size-4 mr-1.5" /> Save as Template
          </Button>
          <Button onClick={add} className="transition-all hover:scale-105 shadow-xs">
            <Plus className="size-4 mr-1.5" /> Add Criterion
          </Button>
        </PageHeader>
      </FadeIn>

      {/* 3D Component Weight Cards Switcher */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {COMPONENTS.map((k) => {
          const Icon = componentIcons[k];
          const isSelected = c === k;
          return (
            <div
              key={k}
              onClick={() => navigate({ to: "/criteria", search: { c: k } })}
              className="cursor-pointer"
            >
              <GlassCard3D
                glowColor={componentGlows[k]}
                className={`transition-all duration-300 relative overflow-hidden ${
                  isSelected
                    ? "ring-2 ring-primary/80 shadow-md bg-card/90"
                    : "opacity-75 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`size-9 rounded-xl grid place-items-center ${
                        k === "pdf"
                          ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                          : k === "github"
                          ? "bg-sky-500/15 text-sky-500 border border-sky-500/30"
                          : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                      }`}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-foreground">
                        {COMPONENT_LABEL[k]}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Official Weight: {componentWeights[k]}%
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="size-2.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-border/40 font-mono">
                  <span className="text-muted-foreground">Rubric Status:</span>
                  <span className="font-bold text-foreground">
                    {isSelected ? `${list.length} Criteria Active` : "Click to Inspect"}
                  </span>
                </div>
              </GlassCard3D>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-muted/40 p-3 rounded-xl border border-border/60">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Active Component:</span>
          <span className="font-bold text-foreground font-mono text-sm capitalize">
            {COMPONENT_LABEL[c]} ({componentWeights[c]}% Event Weight)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Total Enabled Marks:</span>
          <span className="font-mono text-base font-black text-foreground">{fmt(total)}</span>
          {total !== 100 && (
            <span className="text-warning text-xs font-semibold">
              (Auto-normalized to 100% scale)
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {crits.isLoading ? (
          <CardGridSkeleton count={4} className="grid-cols-1" />
        ) : (
          list.map((x, i) => (
            <motion.div
              key={x.id + x.updated_at}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
            >
              <CritRow
                x={x}
                first={i === 0}
                last={i === list.length - 1}
                onMove={(d) => move(i, d)}
                onSave={(p) => update(x.id, p)}
                onDelete={() => remove(x)}
              />
            </motion.div>
          ))
        )}
      </div>
      {!!templates.data?.length && (
        <div className="glass mt-6 rounded-2xl p-5">
          <h3 className="font-semibold">{COMPONENT_LABEL[c]} templates</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {templates.data.map((t) => (
              <div key={t.id} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm">
                {t.name}
                <Button size="sm" variant="ghost" onClick={() => applyTemplate(t)}><FolderOpen className="size-3.5" />Apply</Button>
                <Button size="icon" variant="ghost" className="size-7" onClick={async () => { await supabase.from("evaluation_templates").delete().eq("id", t.id); refresh(); }}><Trash2 className="size-3.5" /></Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function CritRow({ x, first, last, onMove, onSave, onDelete }: { x: Crit; first: boolean; last: boolean; onMove: (d: -1 | 1) => void; onSave: (p: Partial<Crit>) => void; onDelete: () => void }) {
  const [f, setF] = useState({ name: x.name, description: x.description ?? "", instructions: x.instructions ?? "", max_marks: String(x.max_marks), weight: String(x.weight) });
  const dirty = f.name !== x.name || f.description !== (x.description ?? "") || f.instructions !== (x.instructions ?? "") || Number(f.max_marks) !== Number(x.max_marks) || Number(f.weight) !== Number(x.weight);
  const save = () => {
    const m = Number(f.max_marks);
    if (!f.name.trim() || !(m > 0)) return toast.error("Name and positive max marks are required");
    onSave({ name: f.name.trim(), description: f.description, instructions: f.instructions, max_marks: m, weight: Number(f.weight) || 1 });
    toast.success("Criterion saved — affected evaluations flagged for re-evaluation");
  };
  return (
    <div className={`glass rounded-2xl p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs ${x.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col"><Button size="icon" variant="ghost" className="size-6" disabled={first} onClick={() => onMove(-1)}><ArrowUp className="size-3" /></Button><Button size="icon" variant="ghost" className="size-6" disabled={last} onClick={() => onMove(1)}><ArrowDown className="size-3" /></Button></div>
        <Input className="min-w-48 flex-1 font-medium" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Max<Input className="w-20" type="number" value={f.max_marks} onChange={(e) => setF({ ...f, max_marks: e.target.value })} /></label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">Importance<Input className="w-16" type="number" step="0.5" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={x.enabled} onCheckedChange={(v) => onSave({ enabled: v })} />Enabled</label>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="size-4" /></Button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <Textarea rows={2} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Textarea rows={2} placeholder="Evaluation instructions for the AI" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} />
      </div>
      {dirty && <Button size="sm" className="mt-2" onClick={save}>Save changes</Button>}
    </div>
  );
}
