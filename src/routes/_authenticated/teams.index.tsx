import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Play,
  RotateCw,
  Trash2,
  Loader2,
  FileText,
  Github,
  Globe,
  ExternalLink,
  Filter,
  Users,
  X,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  GraduationCap,
  Award,
  Columns,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge, Empty, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { COMPONENTS } from "@/lib/scoring";
import { logActivity } from "@/lib/db";
import { DeleteTeamModal } from "@/components/delete-team-modal";
import { evaluateSingleTeam } from "@/lib/evaluation-engine";
import { TeamReportCard } from "@/components/team-report-card";
import { TeamSubmissionModal } from "@/components/team-submission-modal";
import { runComprehensivePlagiarismScan } from "@/lib/plagiarism";
import { FadeIn, Magnetic, StarBorder } from "@/components/ui/motion-primitives";

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
  const teams = rows.data ?? [];
  const plagiarismMap = useMemo(() => runComprehensivePlagiarismScan(teams), [teams]);

  // Filter States
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [psFilter, setPsFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [qualificationFilter, setQualificationFilter] = useState<"all" | "qualified" | "unqualified">("all");
  const [memberCountFilter, setMemberCountFilter] = useState<"all" | "1" | "2" | "3" | "4">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "score_desc" | "score_asc" | "date_desc">("name_asc");

  // Selection & Modal States
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [teamToDelete, setTeamToDelete] = useState<TeamRow | null>(null);
  const [reportTeam, setReportTeam] = useState<TeamRow | null>(null);
  const [submissionModal, setSubmissionModal] = useState<{ team: TeamRow; tab: "pdf" | "github" | "website" } | null>(null);
  const [evaluatingMap, setEvaluatingMap] = useState<Record<string, boolean>>({});

  // Optional Table Column Visibility State (Persisted in localStorage)
  const [colVis, setColVis] = useState<{
    college: boolean;
    project: boolean;
    members: boolean;
    pdf: boolean;
    github: boolean;
    website: boolean;
    score: boolean;
    status: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem("innovedge_teams_column_vis");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      college: true,
      project: true,
      members: true,
      pdf: true,
      github: true,
      website: true,
      score: true,
      status: true,
    };
  });

  const toggleCol = (key: keyof typeof colVis) => {
    setColVis((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("innovedge_teams_column_vis", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Unique facet values extracted from live team records
  const uniqueColleges = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.college) set.add(t.college);
    });
    return Array.from(set).sort();
  }, [teams]);

  const uniqueProblemStatements = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.problem_statement) {
        set.add(t.problem_statement);
      } else if (t.project_title) {
        const match = t.project_title.match(/^\[(PS-\d+|[^\]]+)\]/i);
        if (match?.[1]) set.add(match[1]);
      }
    });
    return Array.from(set).sort();
  }, [teams]);

  const uniqueTracks = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.track) set.add(t.track);
    });
    return Array.from(set).sort();
  }, [teams]);

  // Multi-Filter & Search Engine
  const list = useMemo(() => {
    const query = q.toLowerCase().trim();

    return teams
      .filter((t) => {
        // 1. Global Search across Team, College, Leader, Member 1–4, Emails, PS, Title, Description
        if (query) {
          const memberNames = (t.members ?? []).map((m) => m.name);
          const memberEmails = (t.members ?? []).map((m) => m.email ?? "");

          const matches = [
            t.name,
            t.email,
            t.college,
            t.track,
            t.problem_statement,
            t.project_title,
            t.project_description,
            ...memberNames,
            ...memberEmails,
          ].some((val) => val?.toLowerCase().includes(query));

          if (!matches) return false;
        }

        // 2. Status Filter
        if (status !== "all" && t.overall !== status) {
          return false;
        }

        // 3. College Filter
        if (collegeFilter !== "all" && t.college?.toLowerCase() !== collegeFilter.toLowerCase()) {
          return false;
        }

        // 4. Problem Statement Filter
        if (psFilter !== "all") {
          const currentPs = t.problem_statement || t.project_title?.match(/^\[(PS-\d+|[^\]]+)\]/i)?.[1];
          if (!currentPs || currentPs.toLowerCase() !== psFilter.toLowerCase()) {
            return false;
          }
        }

        // 5. Track Filter
        if (trackFilter !== "all" && t.track?.toLowerCase() !== trackFilter.toLowerCase()) {
          return false;
        }

        // 6. Qualification Filter
        if (qualificationFilter !== "all") {
          const score = t.officialFinal ?? t.aiFinal ?? 0;
          const isQualified = t.final_status === "approved" || score >= 60;
          if (qualificationFilter === "qualified" && !isQualified) return false;
          if (qualificationFilter === "unqualified" && isQualified) return false;
        }

        // 7. Member Count Filter
        if (memberCountFilter !== "all") {
          const targetCount = parseInt(memberCountFilter, 10);
          const memberLen = (t.members ?? []).length;
          if (memberLen !== targetCount) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        if (sortBy === "name_desc") return b.name.localeCompare(a.name);
        if (sortBy === "score_desc") {
          const scoreA = a.officialFinal ?? a.aiFinal ?? -1;
          const scoreB = b.officialFinal ?? b.aiFinal ?? -1;
          return scoreB - scoreA;
        }
        if (sortBy === "score_asc") {
          const scoreA = a.officialFinal ?? a.aiFinal ?? 999;
          const scoreB = b.officialFinal ?? b.aiFinal ?? 999;
          return scoreA - scoreB;
        }
        if (sortBy === "date_desc") {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return 0;
      });
  }, [teams, q, status, collegeFilter, psFilter, trackFilter, qualificationFilter, memberCountFilter, sortBy]);

  const resetAllFilters = () => {
    setQ("");
    setStatus("all");
    setCollegeFilter("all");
    setPsFilter("all");
    setTrackFilter("all");
    setQualificationFilter("all");
    setMemberCountFilter("all");
    setSortBy("name_asc");
  };

  const hasActiveFilters =
    q.trim() !== "" ||
    status !== "all" ||
    collegeFilter !== "all" ||
    psFilter !== "all" ||
    trackFilter !== "all" ||
    qualificationFilter !== "all" ||
    memberCountFilter !== "all";

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
      <FadeIn>
        <PageHeader title="Registered Teams" desc={`${rows.data?.length ?? 0} teams registered in evaluation platform`}>
          <Magnetic strength={4}>
            <Button asChild variant="secondary">
              <Link to="/import">Bulk import</Link>
            </Button>
          </Magnetic>
          <Magnetic strength={4}>
            <StarBorder as="div" className="cursor-pointer">
              <Link to="/teams/new" className="inline-flex items-center text-primary font-semibold">
                <Plus className="size-4 mr-1.5" /> Add team
              </Link>
            </StarBorder>
          </Magnetic>
        </PageHeader>
      </FadeIn>

      {/* Advanced Filter and Search Bar */}
      <div className="glass p-4 rounded-2xl border border-border/80 mb-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-foreground">
            <Filter className="size-3.5 text-primary" /> Filter &amp; Search Teams
          </span>
          <div className="flex items-center gap-2">
            <span>
              Showing {list.length} of {teams.length} teams {sel.size > 0 && `(${sel.size} selected)`}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1 px-2 font-normal">
                  <Columns className="size-3 text-primary" />
                  <span>Columns ({Object.values(colVis).filter(Boolean).length}/8)</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3 space-y-2 text-xs">
                <div className="font-semibold text-foreground text-xs pb-1.5 border-b border-border/60">
                  Visible Table Columns
                </div>
                <div className="space-y-1.5 pt-0.5">
                  {[
                    { id: "college", label: "Team & College" },
                    { id: "project", label: "Project & Track" },
                    { id: "members", label: "Team Members (1–4)" },
                    { id: "pdf", label: "Pitch Deck (PDF)" },
                    { id: "github", label: "GitHub Code" },
                    { id: "website", label: "Live Website" },
                    { id: "score", label: "Final Score" },
                    { id: "status", label: "Evaluation Status" },
                  ].map((col) => (
                    <label key={col.id} className="flex items-center gap-2 cursor-pointer hover:text-foreground">
                      <Checkbox
                        checked={colVis[col.id as keyof typeof colVis]}
                        onCheckedChange={() => toggleCol(col.id as keyof typeof colVis)}
                      />
                      <span className="text-xs">{col.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* 1. Global Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-xs bg-background/80"
              placeholder="Search team, college, leader, member 1–4, email, PS..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* 2. Evaluation Status */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-xs bg-background/80">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["all", "pending", "processing", "completed", "stale", "failed", "approved", "rejected"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s === "all" ? "All Statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 3. College Filter */}
          <Select value={collegeFilter} onValueChange={setCollegeFilter}>
            <SelectTrigger className="h-9 text-xs bg-background/80 truncate">
              <SelectValue placeholder="College" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Colleges ({uniqueColleges.length})</SelectItem>
              {uniqueColleges.map((col) => (
                <SelectItem key={col} value={col}>
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 4. Problem Statement Filter */}
          <Select value={psFilter} onValueChange={setPsFilter}>
            <SelectTrigger className="h-9 text-xs bg-background/80 truncate">
              <SelectValue placeholder="Problem Statement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Problems ({uniqueProblemStatements.length})</SelectItem>
              {uniqueProblemStatements.map((ps) => (
                <SelectItem key={ps} value={ps}>
                  {ps}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 5. Sort By */}
          <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
            <SelectTrigger className="h-9 text-xs bg-background/80">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A → Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              <SelectItem value="score_desc">Final Score (High → Low)</SelectItem>
              <SelectItem value="score_asc">Final Score (Low → High)</SelectItem>
              <SelectItem value="date_desc">Recently Added</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Secondary Filters Strip (Qualification & Team Size) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Quick Filters:</span>
            <Button
              variant={qualificationFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setQualificationFilter("all")}
              className="h-7 text-[11px] px-2.5"
            >
              All Teams
            </Button>
            <Button
              variant={qualificationFilter === "qualified" ? "default" : "outline"}
              size="sm"
              onClick={() => setQualificationFilter("qualified")}
              className="h-7 text-[11px] px-2.5 gap-1"
            >
              <Award className="size-3 text-emerald-500" />
              Qualified Only
            </Button>
            <Button
              variant={qualificationFilter === "unqualified" ? "default" : "outline"}
              size="sm"
              onClick={() => setQualificationFilter("unqualified")}
              className="h-7 text-[11px] px-2.5"
            >
              Pending / Unqualified
            </Button>
            <span className="text-border mx-1">|</span>
            <span className="text-muted-foreground">Team Size:</span>
            {["all", "4", "3", "2", "1"].map((cnt) => (
              <Button
                key={cnt}
                variant={memberCountFilter === cnt ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMemberCountFilter(cnt as any)}
                className="h-6 text-[10px] px-2"
              >
                {cnt === "all" ? "Any" : `${cnt}p`}
              </Button>
            ))}
          </div>

          {sel.size > 0 && (
            <Button variant="destructive" size="sm" onClick={del} className="h-7 text-xs">
              <Trash2 className="size-3.5 mr-1.5" /> Delete Selected ({sel.size})
            </Button>
          )}
        </div>

        {/* Active Filter Chips Strip */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
            <span className="text-muted-foreground mr-1">Active filters:</span>
            {q && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                Search: {q}
                <X className="size-3 cursor-pointer" onClick={() => setQ("")} />
              </Badge>
            )}
            {status !== "all" && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2 capitalize">
                Status: {status}
                <X className="size-3 cursor-pointer" onClick={() => setStatus("all")} />
              </Badge>
            )}
            {collegeFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                College: {collegeFilter}
                <X className="size-3 cursor-pointer" onClick={() => setCollegeFilter("all")} />
              </Badge>
            )}
            {psFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                PS: {psFilter}
                <X className="size-3 cursor-pointer" onClick={() => setPsFilter("all")} />
              </Badge>
            )}
            {trackFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                Track: {trackFilter}
                <X className="size-3 cursor-pointer" onClick={() => setTrackFilter("all")} />
              </Badge>
            )}
            {qualificationFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2 capitalize">
                Qualification: {qualificationFilter}
                <X className="size-3 cursor-pointer" onClick={() => setQualificationFilter("all")} />
              </Badge>
            )}
            {memberCountFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                Members: {memberCountFilter}
                <X className="size-3 cursor-pointer" onClick={() => setMemberCountFilter("all")} />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground ml-auto px-2"
            >
              <RotateCcw className="size-3 mr-1" /> Reset all
            </Button>
          </div>
        )}
      </div>

      {rows.isLoading ? (
        <TableSkeleton rows={7} cols={6} />
      ) : !list.length ? (
        <Empty title="No teams found" desc="No records match your active search or filters.">
          <Button variant="outline" onClick={resetAllFilters} className="mr-2">
            Reset Filters
          </Button>
          <Button asChild>
            <Link to="/teams/new">Add team</Link>
          </Button>
        </Empty>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl border border-border/80">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/40 border-b border-border">
              <tr>
                <th className="p-3 pl-4">
                  <Checkbox
                    checked={sel.size === list.length && list.length > 0}
                    onCheckedChange={(v) => setSel(v ? new Set(list.map((t) => t.id)) : new Set())}
                  />
                </th>
                {colVis.college && <th className="p-3">Team &amp; College</th>}
                {colVis.project && <th className="p-3">Project &amp; Track</th>}
                {colVis.members && <th className="p-3">Team Members (1–4)</th>}
                {colVis.pdf && <th className="p-3 text-right">PDF</th>}
                {colVis.github && <th className="p-3 text-right">GitHub</th>}
                {colVis.website && <th className="p-3 text-right">Website</th>}
                {colVis.score && <th className="p-3 text-right">Final</th>}
                {colVis.status && <th className="p-3 text-center">Status</th>}
                <th className="p-3 pr-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {list.map((t) => {
                const isEvaluating = evaluatingMap[t.id] || t.overall === "processing";
                const isCompleted = t.overall === "completed" || t.overall === "approved";
                const plag = plagiarismMap.get(t.id);
                const teamMembers = t.members ?? [];

                return (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/35 hover:shadow-xs transition-all duration-200 group"
                  >
                    <td className="p-3 pl-4 align-top">
                      <Checkbox
                        checked={sel.has(t.id)}
                        onCheckedChange={(v) => {
                          const n = new Set(sel);
                          v ? n.add(t.id) : n.delete(t.id);
                          setSel(n);
                        }}
                      />
                    </td>
                    {/* Team & College */}
                    {colVis.college && (
                      <td className="p-3 align-top max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <Link
                            to="/teams/$id"
                            params={{ id: t.id }}
                            className="font-bold hover:text-primary transition-colors truncate"
                          >
                            {t.name}
                          </Link>
                          {plag?.isFlagged && (
                            <Link
                              to="/plagiarism"
                              title={`Flagged for ${plag.overallSimilarity}% plagiarism`}
                              className="shrink-0"
                            >
                              <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                Flagged
                              </Badge>
                            </Link>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{t.email}</div>
                        {t.college && (
                          <div className="text-[11px] text-primary/80 font-medium flex items-center gap-1 mt-1 truncate" title={t.college}>
                            <GraduationCap className="size-3 shrink-0" />
                            <span className="truncate">{t.college}</span>
                          </div>
                        )}

                        {/* Quick Artifacts & Submission Links */}
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
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
                    )}

                    {/* Project & Track */}
                    {colVis.project && (
                      <td className="max-w-60 p-3 align-top text-muted-foreground">
                        {t.project_title?.startsWith("[") ? (
                          <div className="space-y-1">
                            <span className="inline-block font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                              {t.project_title.match(/^\[([^\]]+)\]/)?.[1] ?? "PS"}
                            </span>
                            <div className="truncate font-medium text-foreground text-xs" title={t.project_title}>
                              {t.project_title.replace(/^\[[^\]]+\]\s*/, "")}
                            </div>
                          </div>
                        ) : (
                          <div className="truncate font-medium text-foreground text-xs" title={t.project_title ?? ""}>
                            {t.project_title || "General Proposal"}
                          </div>
                        )}
                        {t.track && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Track: {t.track}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Team Members (All 4 supported) */}
                    {colVis.members && (
                      <td className="p-3 align-top min-w-48">
                        <div className="flex items-center gap-1 text-muted-foreground font-semibold text-[11px] mb-1">
                          <Users className="size-3" />
                          <span>{teamMembers.length} member(s)</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {teamMembers.map((m, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground border border-border/40"
                              title={m.email ? `${m.name} (${m.email})` : m.name}
                            >
                              <span className="font-bold text-primary">{idx + 1}.</span>
                              <span className="truncate max-w-28">{m.name}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    )}

                    {/* Component Scores */}
                    {colVis.pdf && (
                      <td className="p-3 text-right font-mono align-top">
                        {t.evals?.pdf?.final_score != null ? fmt(t.evals.pdf.final_score) : "—"}
                      </td>
                    )}
                    {colVis.github && (
                      <td className="p-3 text-right font-mono align-top">
                        {t.evals?.github?.final_score != null ? fmt(t.evals.github.final_score) : "—"}
                      </td>
                    )}
                    {colVis.website && (
                      <td className="p-3 text-right font-mono align-top">
                        {t.evals?.website?.final_score != null ? fmt(t.evals.website.final_score) : "—"}
                      </td>
                    )}

                    {/* Final Score */}
                    {colVis.score && (
                      <td className="p-3 text-right font-mono font-bold text-primary align-top">
                        {fmt(t.officialFinal ?? t.aiFinal)}
                      </td>
                    )}

                    {/* Status Badge */}
                    {colVis.status && (
                      <td className="p-3 text-center align-top">
                        <StatusBadge status={isEvaluating ? "processing" : t.overall} />
                      </td>
                    )}

                    {/* Actions */}
                    <td className="p-3 pr-4 text-center align-top">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Independent Evaluate button */}
                        <Button
                          size="sm"
                          variant={isEvaluating ? "default" : isCompleted ? "outline" : "shimmer"}
                          disabled={isEvaluating}
                          onClick={() => handleSingleEvaluate(t, isCompleted)}
                          className="h-7 px-2 text-xs font-semibold shadow-xs"
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Team Report Card Modal */}
      {reportTeam && (
        <TeamReportCard
          team={reportTeam}
          isOpen={!!reportTeam}
          onClose={() => setReportTeam(null)}
        />
      )}

      {/* Team Submission Modal (PDF / GitHub / Website preview) */}
      {submissionModal && (
        <TeamSubmissionModal
          team={submissionModal.team}
          defaultTab={submissionModal.tab}
          isOpen={!!submissionModal}
          onClose={() => setSubmissionModal(null)}
        />
      )}

      {/* Delete Team Modal */}
      {teamToDelete && (
        <DeleteTeamModal
          team={teamToDelete}
          isOpen={!!teamToDelete}
          onClose={() => setTeamToDelete(null)}
          onDeleted={() => {
            setTeamToDelete(null);
            qc.invalidateQueries();
          }}
        />
      )}
    </>
  );
}
