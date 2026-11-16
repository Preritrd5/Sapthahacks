import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Play, RotateCw, Trash2, Loader2, FileText, Github, Globe, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Empty, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { COMPONENTS } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import { DeleteTeamModal } from "@/components/delete-team-modal";
import { evaluateSingleTeam } from "@/lib/evaluation-engine";
import { TeamReportCard } from "@/components/team-report-card";
import { TeamSubmissionModal } from "@/components/team-submission-modal";

export const Route = createFileRoute("/_authenticated/teams/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Teams — INNOVEDGE Assessor" },
      { name: "description", content: "All registered hackathon teams and individual evaluation triggers." },
      { property: "og:title", content: "Teams — INNOVEDGE Assessor" },
      { property: "og:description", content: "All registered hackathon teams and individual evaluation triggers." },
    ],
  }),
  component: Teams,
});

function Teams() {
  const rows = useTeamRows();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [teamToDelete, setTeamToDelete] = useState<TeamRow | null>(null);
  const [reportTeam, setReportTeam] = useState<TeamRow | null>(null);
  const [submissionModal, setSubmissionModal] = useState<{ team: TeamRow; tab: "pdf" | "github" | "website" } | null>(null);
  const [evaluatingMap, setEvaluatingMap] = useState<Record<string, boolean>>({});

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (rows.data ?? [])
      .filter((t) => !s || [t.name, t.email, t.project_title].some((v) => v?.toLowerCase().includes(s)))
      .filter((t) => status === "all" || t.overall === status)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows.data, q, status]);

  // Evaluate single team independently
  const handleSingleEvaluate = async (team: TeamRow, forceRerun: boolean = false) => {
    setEvaluatingMap((prev) => ({ ...prev, [team.id]: true }));
    toast.info(`Evaluating "${team.name}"...`);
    try {
      await evaluateSingleTeam(team, [...COMPONENTS], { forceRerun });
      toast.success(`Evaluation completed for "${team.name}"!`);
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err?.message || "Failed to evaluate team");
    } finally {
      setEvaluatingMap((prev) => ({ ...prev, [team.id]: false }));
      qc.invalidateQueries();
    }
  };

  const del = async () => {
    if (!confirm(`Delete ${sel.size} team(s) and all their evaluations?`)) return;
    await supabase.from("teams").delete().in("id", [...sel]);
    await logActivity("Deleted teams", `${sel.size} team(s)`);
    setSel(new Set());
    qc.invalidateQueries();
  };

  return (
    <>
      <PageHeader title="Registered Teams" desc={`${rows.data?.length ?? 0} teams registered`}>
        <Button asChild variant="secondary">
          <Link to="/import">Bulk import</Link>
        </Button>
        <Button asChild>
          <Link to="/teams/new">
            <Plus className="size-4 mr-1.5" /> Add team
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-2">
        <div className="relative min-w-0 sm:min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email or project title"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "pending", "processing", "completed", "stale", "failed", "approved", "rejected"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sel.size > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="destructive" size="sm" onClick={del}>
              <Trash2 className="size-4 mr-1.5" /> Delete Selected ({sel.size})
            </Button>
          </div>
        )}
      </div>

      {rows.isLoading ? (
        <div className="glass h-64 animate-pulse rounded-2xl" />
      ) : !list.length ? (
        <Empty title="No teams found" desc="Add teams manually or import a CSV/XLSX file.">
          <Button asChild>
            <Link to="/teams/new">Add team</Link>
          </Button>
        </Empty>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-3">
                  <Checkbox
                    checked={sel.size === list.length && list.length > 0}
                    onCheckedChange={(v) => setSel(v ? new Set(list.map((t) => t.id)) : new Set())}
                  />
                </th>
                <th className="p-3">Team</th>
                <th className="p-3">Project</th>
                <th className="p-3 text-right">PDF</th>
                <th className="p-3 text-right">GitHub</th>
                <th className="p-3 text-right">Website</th>
                <th className="p-3 text-right">Final</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const isEvaluating = evaluatingMap[t.id] || t.overall === "processing";
                const isCompleted = t.overall === "completed" || t.overall === "approved";

                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-accent/30">
                    <td className="p-3">
                      <Checkbox
                        checked={sel.has(t.id)}
                        onCheckedChange={(v) => {
                          const n = new Set(sel);
                          v ? n.add(t.id) : n.delete(t.id);
                          setSel(n);
                        }}
                      />
                    </td>
                    <td className="p-3">
                      <Link to="/teams/$id" params={{ id: t.id }} className="font-bold hover:text-primary">
                        {t.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{t.email}</div>
                      
                      {/* Quick Artifacts & Submission Links */}
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {t.pdf_text || t.pdf_path ? (
                          <button
                            onClick={() => setSubmissionModal({ team: t, tab: "pdf" })}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                            title="View PDF"
                          >
                            <FileText className="size-2.5" /> PDF
                          </button>
                        ) : null}
                        {t.github_url ? (
                          <a
                            href={t.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 hover:bg-sky-500/20"
                            title={`GitHub: ${t.github_url}`}
                          >
                            <Github className="size-2.5" /> Code <ExternalLink className="size-2" />
                          </a>
                        ) : null}
                        {t.website_url ? (
                          <a
                            href={t.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                            title={`Website: ${t.website_url}`}
                          >
                            <Globe className="size-2.5" /> Site <ExternalLink className="size-2" />
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-64 truncate p-3 text-muted-foreground">
                      {t.project_title?.startsWith("[") ? (
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                            {t.project_title.match(/^\[([^\]]+)\]/)?.[1] ?? "PS"}
                          </span>
                          <span className="truncate">{t.project_title.replace(/^\[[^\]]+\]\s*/, "")}</span>
                        </div>
                      ) : (
                        t.project_title
                      )}
                    </td>
                    {COMPONENTS.map((c) => {
                      const e = t.evals?.[c];
                      return (
                        <td key={c} className="p-3 text-right font-mono">
                          {e?.final_score != null ? fmt(e.final_score) : "—"}
                        </td>
                      );
                    })}
                    <td className="p-3 text-right font-mono font-bold text-primary">
                      {fmt(t.officialFinal ?? t.aiFinal)}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={isEvaluating ? "processing" : t.overall} />
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Independent Evaluate button */}
                        <Button
                          size="sm"
                          variant={isCompleted ? "outline" : "default"}
                          disabled={isEvaluating}
                          onClick={() => handleSingleEvaluate(t, isCompleted)}
                          className="h-7 px-2 text-xs"
                        >
                          {isEvaluating ? (
                            <>
                              <Loader2 className="size-3 animate-spin mr-1" /> Evaluating
                            </>
                          ) : isCompleted ? (
                            <>
                              <RotateCw className="size-3 mr-1" /> Re-evaluate
                            </>
                          ) : (
                            <>
                              <Play className="size-3 mr-1 fill-current" /> Evaluate
                            </>
                          )}
                        </Button>

                        {/* View Report */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReportTeam(t)}
                          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <FileText className="size-3 mr-1" /> View Report
                        </Button>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTeamToDelete(t)}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 h-7 px-2 text-xs"
                          title="Delete team"
                        >
                          <Trash2 className="size-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      <DeleteTeamModal
        team={teamToDelete}
        isOpen={!!teamToDelete}
        onClose={() => setTeamToDelete(null)}
      />

      {/* Official 1-Page Scorecard Modal */}
      <TeamReportCard
        team={reportTeam}
        isOpen={!!reportTeam}
        onClose={() => setReportTeam(null)}
      />

      {/* Team Submission Artifacts & Links Modal */}
      <TeamSubmissionModal
        team={submissionModal?.team ?? null}
        defaultTab={submissionModal?.tab}
        isOpen={!!submissionModal}
        onClose={() => setSubmissionModal(null)}
      />
    </>
  );
}
