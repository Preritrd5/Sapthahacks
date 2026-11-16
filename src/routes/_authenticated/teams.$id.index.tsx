import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Github, Globe, Pencil, Printer, Trash2, Play, Lightbulb, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { EvalCard } from "@/components/eval-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTeamRows, useWeights } from "@/lib/queries";
import { updatePersistentTeam, deletePersistentTeam, getPersistentMembers } from "@/lib/team-store";
import { DeleteTeamModal } from "@/components/delete-team-modal";
import { COMPONENTS, COMPONENT_LABEL } from "@/lib/scoring";
import { enqueue, logActivity } from "@/lib/db";
import { useQueueRunner } from "@/lib/queue-runner";
import { runDirectEvaluation } from "@/lib/evaluation-engine";

export const Route = createFileRoute("/_authenticated/teams/$id/")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Team evaluation — Assessor" }, { name: "description", content: "Team details and evaluation." }, { property: "og:title", content: "Team evaluation — Assessor" }, { property: "og:description", content: "Team details and evaluation." }] }),
  component: TeamPage,
});

function TeamPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const runner = useQueueRunner();
  const rows = useTeamRows();
  const weights = useWeights();
  const t = rows.data?.find((x) => x.id === id);
  const members = useQuery({
    queryKey: ["members", id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("team_members")
          .select("*")
          .eq("team_id", id)
          .order("position");
        if (!error && data && data.length > 0) return data;
      } catch { }
      return getPersistentMembers(id);
    },
  });
  const history = useQuery({ queryKey: ["history", id], queryFn: async () => (await supabase.from("evaluation_history").select("*").eq("team_id", id).order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const pdfUrl = useQuery({ queryKey: ["pdf-url", t?.pdf_path], enabled: !!t?.pdf_path, queryFn: async () => (await supabase.storage.from("project-pdfs").createSignedUrl(t!.pdf_path!, 3600)).data?.signedUrl ?? null });
  const [remarks, setRemarks] = useState("");
  const [override, setOverride] = useState("");
  const [reason, setReason] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [evaluatingAll, setEvaluatingAll] = useState(false);

  useEffect(() => { if (t) { setRemarks(t.remarks ?? ""); setOverride(t.final_override?.toString() ?? ""); setReason(t.override_reason ?? ""); } }, [t?.id]);

  if (rows.isLoading) return <div className="glass h-96 animate-pulse rounded-2xl" />;
  if (!t) return <p className="p-8 text-center text-muted-foreground">Team not found.</p>;

  const uid = async () => (await supabase.auth.getUser()).data.user?.id ?? null;
  const setFinal = async (status: "approved" | "rejected" | "pending") => {
    if (status === "approved" && t.approvedFinal == null && !t.final_override) return toast.error(`Approve all components first (missing: ${t.missing.map((m) => COMPONENT_LABEL[m]).join(", ")}) or set an override.`);
    updatePersistentTeam(id, { final_status: status });
    try {
      await supabase.from("teams").update({ final_status: status }).eq("id", id);
      await supabase.from("evaluation_history").insert({ team_id: id, action: `final ${status}`, actor: await uid(), details: { score: t.officialFinal } });
      await logActivity(`Final evaluation ${status}`, t.name);
    } catch { }
    qc.invalidateQueries();
  };
  const saveOverride = async () => {
    const v = override === "" ? null : Number(override);
    if (v != null && (!Number.isFinite(v) || v < 0 || v > 100)) return toast.error("Override must be 0–100");
    if (v != null && !reason.trim()) return toast.error("A reason is required for overrides");
    updatePersistentTeam(id, { final_override: v, override_reason: v == null ? null : reason, remarks });
    try {
      await supabase.from("teams").update({ final_override: v, override_reason: v == null ? null : reason, remarks }).eq("id", id);
      await supabase.from("admin_score_overrides").insert({ team_id: id, field: "final_score", previous_value: t.final_override ?? t.approvedFinal, new_value: v, reason: v == null ? "Override removed" : reason, edited_by: await uid() });
      await supabase.from("evaluation_history").insert({ team_id: id, action: v == null ? "override removed" : "final override", actor: await uid(), details: { value: v, reason } });
    } catch { }
    toast.success("Saved");
    qc.invalidateQueries();
  };
  const del = async () => {
    if (!confirm(`Delete ${t.name}?`)) return;
    deletePersistentTeam(id);
    try {
      if (t.pdf_path) await supabase.storage.from("project-pdfs").remove([t.pdf_path]);
      await supabase.from("teams").delete().eq("id", id);
      await logActivity("Deleted team", t.name);
    } catch { }
    qc.invalidateQueries();
    navigate({ to: "/teams" });
  };
  const evalAll = async () => {
    setEvaluatingAll(true);
    toast.info(`Running live multi-modal evaluation for ${t.name}...`);
    try {
      await runDirectEvaluation(t, [...COMPONENTS]);
      toast.success(`Evaluations completed for ${t.name}!`);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err?.message || "Failed to run evaluation");
    } finally {
      setEvaluatingAll(false);
    }
  };

  return (
    <>
      <PageHeader title={t.name} desc={t.project_title ?? undefined}>
        <Button variant="secondary" onClick={evalAll} disabled={evaluatingAll}>
          {evaluatingAll ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Play className="size-4 mr-1.5" />}
          {evaluatingAll ? "Evaluating…" : "Evaluate all"}
        </Button>
        <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" />PDF report</Button>
        <Button variant="secondary" asChild><Link to="/teams/$id/edit" params={{ id }}><Pencil className="size-4" />Edit</Link></Button>
        <Button
          variant="ghost"
          className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
          onClick={() => setShowDeleteModal(true)}
          title="Delete team"
        >
          <Trash2 className="size-4 mr-1.5" />
          <span>Delete Team</span>
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          {t.project_title && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary">
              <Lightbulb className="size-3.5" />
              <span>Problem Statement: {t.project_title}</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.project_description || "No description."}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {t.email && <span className="rounded-lg bg-muted px-2 py-1">{t.email}</span>}
            {t.github_url && <a href={t.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 hover:text-primary"><Github className="size-3.5" />Repository<ExternalLink className="size-3" /></a>}
            {t.website_url && <a href={t.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 hover:text-primary"><Globe className="size-3.5" />Website<ExternalLink className="size-3" /></a>}
            {t.pdf_path ? <button onClick={() => setShowPdf(!showPdf)} className="no-print flex items-center gap-1 rounded-lg bg-muted px-2 py-1 hover:text-primary"><FileText className="size-3.5" />{showPdf ? "Hide" : "Preview"} PDF</button> : <span className="rounded-lg bg-warning/10 px-2 py-1 text-warning">No PDF</span>}
          </div>
          <div className="mt-4"><div className="text-xs uppercase text-muted-foreground">Members ({members.data?.length ?? 0})</div>
            <div className="mt-2 flex flex-wrap gap-2">{members.data?.map((m) => <span key={m.id} className="rounded-lg border border-border px-2 py-1 text-xs">{m.name}{m.email && <span className="text-muted-foreground"> · {m.email}</span>}</span>)}</div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-xs uppercase text-muted-foreground">Overall score</div>
          <div className="mt-1 font-display text-4xl font-semibold">{fmt(t.officialFinal)}<span className="text-base text-muted-foreground"> / 100</span></div>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div>AI-generated final: {fmt(t.aiFinal)}</div>
            <div>Admin-approved final: {t.approvedFinal != null ? fmt(t.approvedFinal) : `incomplete (${t.missing.map((m) => COMPONENT_LABEL[m]).join(", ") || "—"} not approved)`}</div>
            {t.final_override != null && <div className="text-violet">Override: {fmt(t.final_override)} — {t.override_reason}</div>}
            <div>Weights: PDF {weights.data?.pdf}% · GitHub {weights.data?.github}% · Website {weights.data?.website}%</div>
          </div>
          <div className="mt-3 flex items-center gap-2"><StatusBadge status={t.final_status} /></div>
          <div className="no-print mt-4 flex gap-2">
            <Button size="sm" onClick={() => setFinal("approved")}>Approve final</Button>
            <Button size="sm" variant="destructive" onClick={() => setFinal("rejected")}>Reject</Button>
            {t.final_status !== "pending" && <Button size="sm" variant="ghost" onClick={() => setFinal("pending")}>Reset</Button>}
          </div>
        </div>
      </div>

      {showPdf && (
        <div className="no-print mt-4 rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2">
              <FileText className="size-4 text-rose-500" /> Project PDF Document Preview
            </span>
            {pdfUrl.data && (
              <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                <a href={pdfUrl.data} target="_blank" rel="noreferrer">Open PDF File</a>
              </Button>
            )}
          </div>
          {pdfUrl.data && (
            <iframe title="PDF" src={pdfUrl.data} className="h-[65vh] w-full rounded-xl border border-border" />
          )}
          {t.pdf_text && (
            <div className="rounded-xl bg-muted/30 p-3 border border-border/40">
              <div className="text-xs font-bold uppercase text-muted-foreground mb-1.5">Extracted Document Text</div>
              <pre className="text-xs font-mono whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed select-text text-foreground/90">
                {t.pdf_text}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {COMPONENTS.map((c) => <EvalCard key={c} teamId={id} component={c} evaluation={t.evals?.[c]} />)}
      </div>

      <div className="no-print mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass space-y-3 rounded-2xl p-5">
          <h3 className="font-semibold">Remarks & final override</h3>
          <Textarea placeholder="Admin remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          <div className="flex gap-2"><Input type="number" placeholder="Override final (0–100), blank = none" value={override} onChange={(e) => setOverride(e.target.value)} /><Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <Button size="sm" onClick={saveOverride}>Save</Button>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold">Evaluation history</h3>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
            {!history.data?.length && <p className="text-muted-foreground">No history yet.</p>}
            {history.data?.map((h) => (
              <div key={h.id} className="flex gap-3 border-b border-border/50 pb-2">
                <span className="w-32 shrink-0 text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                <span><span className="font-medium capitalize">{h.action}</span>{h.component && <span className="text-muted-foreground"> · {COMPONENT_LABEL[h.component as "pdf"]}</span>}
                  {h.details && <span className="block text-muted-foreground">{summarize(h.details)}</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DeleteTeamModal
        team={t}
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => navigate({ to: "/teams" })}
      />
    </>
  );
}

function summarize(d: any) {
  if (d.criterion) return `${d.criterion}${d.previous != null ? `: ${d.previous} → ${d.new}` : ""}${d.reason ? ` (${d.reason})` : ""}`;
  if (d.ai_score != null) return `AI score ${d.ai_score}/${d.max}`;
  if (d.value !== undefined) return `Value ${d.value ?? "none"}${d.reason ? ` — ${d.reason}` : ""}`;
  return "";
}
