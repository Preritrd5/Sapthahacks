import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Trophy, Medal, Sparkles, Crown } from "lucide-react";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-primitives";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useTeamRows, type TeamRow } from "@/lib/queries";
import { rankWithTies } from "@/lib/scoring";
import { exportRows } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Leaderboard — Assessor" },
      { name: "description", content: "Official ranking of approved evaluations." },
      { property: "og:title", content: "Leaderboard — Assessor" },
      { property: "og:description", content: "Official ranking of approved evaluations." },
    ],
  }),
  component: Board,
});

const compPct = (t: TeamRow, c: "pdf" | "github" | "website") => {
  const e = t.evals?.[c];
  return e?.final_score != null && e.max_score ? (Number(e.final_score) / Number(e.max_score)) * 100 : null;
};

function leaderboardRows(rows: TeamRow[], includePending: boolean) {
  const official = rows
    .filter((t) => t.final_status === "approved" && t.officialFinal != null)
    .map((t) => ({ t, score: t.officialFinal!, official: true }));
  const ranked = rankWithTies(official);
  const pending = includePending
    ? rows
        .filter((t) => !(t.final_status === "approved" && t.officialFinal != null))
        .map((t) => ({
          t,
          score: t.officialFinal ?? t.aiFinal ?? -1,
          official: false,
          rank: null as number | null,
          tied: false,
        }))
        .sort((a, b) => b.score - a.score)
    : [];
  return [...ranked, ...pending];
}

function Board() {
  const rows = useTeamRows();
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(true);
  const list = useMemo(
    () =>
      leaderboardRows(rows.data ?? [], pending).filter(
        (x) =>
          !q ||
          x.t.name.toLowerCase().includes(q.toLowerCase()) ||
          x.t.project_title?.toLowerCase().includes(q.toLowerCase())
      ),
    [rows.data, pending, q]
  );
  const flat = () =>
    list.map((x) => ({
      Rank: x.rank ?? "pending",
      Team: x.t.name,
      Project: x.t.project_title,
      PDF: compPct(x.t, "pdf")?.toFixed(2) ?? "",
      GitHub: compPct(x.t, "github")?.toFixed(2) ?? "",
      Website: compPct(x.t, "website")?.toFixed(2) ?? "",
      Final: x.official ? x.score.toFixed(2) : "",
      "AI final": x.t.aiFinal?.toFixed(2) ?? "",
      Status: x.official ? "approved" : x.t.overall,
      Tied: x.tied ? "yes" : "",
    }));

  const topThree = useMemo(() => {
    return list.filter((x) => x.score > 0).slice(0, 3);
  }, [list]);

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Official Leaderboard"
          desc="Official competitive ranking of approved evaluations. Pending entries are clearly indicated."
        >
          <Button variant="secondary" onClick={() => exportRows(flat(), "leaderboard", "csv")}>
            <Download className="size-4 mr-1.5" /> CSV
          </Button>
          <Button variant="secondary" onClick={() => exportRows(flat(), "leaderboard", "xlsx")}>
            <Download className="size-4 mr-1.5" /> Excel
          </Button>
        </PageHeader>
      </FadeIn>

      {/* Top 3 Official Podium Showcase */}
      {!rows.isLoading && !q && topThree.length >= 2 && (
        <FadeIn direction="up" delay={0.1} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
            {/* 2nd Place (Silver) */}
            {topThree[1] && (
              <div className="order-2 md:order-1">
                <GlassCard3D
                  glowColor="rgba(148, 163, 184, 0.25)"
                  className="p-4 rounded-2xl border-slate-400/30 bg-slate-500/5 text-center relative overflow-hidden group"
                >
                  <div className="size-9 mx-auto mb-2 rounded-full bg-slate-400/20 text-slate-300 grid place-items-center font-bold text-sm border border-slate-400/40">
                    #2
                  </div>
                  <h3 className="font-display font-bold text-base truncate text-foreground">
                    {topThree[1].t.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {topThree[1].t.project_title || "Innovation Proposal"}
                  </p>
                  <div className="mt-2 font-mono text-2xl font-black text-slate-300">
                    <AnimatedNumber value={topThree[1].score} precision={1} />
                    <span className="text-xs font-normal text-muted-foreground font-sans"> / 100</span>
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={topThree[1].official ? "approved" : "pending"} />
                  </div>
                </GlassCard3D>
              </div>
            )}

            {/* 1st Place (Gold Champion) */}
            {topThree[0] && (
              <div className="order-1 md:order-2 md:-translate-y-2">
                <GlassCard3D
                  glowColor="rgba(245, 158, 11, 0.35)"
                  intensity={15}
                  className="p-5 rounded-2xl border-amber-500/50 bg-amber-500/10 text-center relative overflow-hidden shadow-lg shadow-amber-500/10 group"
                >
                  <div className="absolute top-2 right-2">
                    <Sparkles className="size-4 text-amber-500 animate-pulse" />
                  </div>
                  <div className="size-11 mx-auto mb-2 rounded-full bg-amber-500/25 text-amber-500 grid place-items-center font-bold text-base border-2 border-amber-500/60 shadow-sm shadow-amber-500/20 animate-float">
                    <Crown className="size-6 text-amber-400 fill-amber-400" />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-0.5">
                    Event Champion
                  </div>
                  <h3 className="font-display font-black text-lg truncate text-foreground">
                    {topThree[0].t.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 font-medium">
                    {topThree[0].t.project_title || "Grand Jury Winner"}
                  </p>
                  <div className="mt-2 font-mono text-3xl font-black text-amber-500">
                    <AnimatedNumber value={topThree[0].score} precision={1} />
                    <span className="text-xs font-normal text-muted-foreground font-sans"> / 100</span>
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={topThree[0].official ? "approved" : "pending"} />
                  </div>
                </GlassCard3D>
              </div>
            )}

            {/* 3rd Place (Bronze) */}
            {topThree[2] && (
              <div className="order-3">
                <GlassCard3D
                  glowColor="rgba(217, 119, 6, 0.25)"
                  className="p-4 rounded-2xl border-amber-700/30 bg-amber-700/5 text-center relative overflow-hidden group"
                >
                  <div className="size-9 mx-auto mb-2 rounded-full bg-amber-700/20 text-amber-600 dark:text-amber-400 grid place-items-center font-bold text-sm border border-amber-700/40">
                    #3
                  </div>
                  <h3 className="font-display font-bold text-base truncate text-foreground">
                    {topThree[2].t.name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {topThree[2].t.project_title || "Innovation Proposal"}
                  </p>
                  <div className="mt-2 font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
                    <AnimatedNumber value={topThree[2].score} precision={1} />
                    <span className="text-xs font-normal text-muted-foreground font-sans"> / 100</span>
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={topThree[2].official ? "approved" : "pending"} />
                  </div>
                </GlassCard3D>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
        <Input
          className="w-full sm:w-64 bg-background text-xs"
          placeholder="Search teams or projects..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Switch checked={pending} onCheckedChange={setPending} />
          Show pending unapproved entries
        </label>
      </div>

      {rows.isLoading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : (
        <div className="glass overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
            <tr className="border-b border-border/80">
              <th className="p-3.5 pl-4">Rank</th>
              <th className="p-3.5">Team</th>
              <th className="p-3.5">Project</th>
              <th className="p-3.5 text-right">PDF</th>
              <th className="p-3.5 text-right">GitHub</th>
              <th className="p-3.5 text-right">Website</th>
              <th className="p-3.5 text-right">Final Score</th>
              <th className="p-3.5 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No ranked entries found.
                </td>
              </tr>
            )}
            {list.map((x) => (
              <tr
                key={x.t.id}
                className={cn(
                  "border-b border-border/40 hover:bg-muted/30 transition-all duration-200 group",
                  !x.official && "opacity-75"
                )}
              >
                <td className="p-3.5 pl-4 font-display font-semibold">
                  {x.rank != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 font-bold transition-transform duration-200 group-hover:scale-105",
                        x.rank === 1 && "bg-amber-500/15 text-amber-500 border border-amber-500/40 px-2 py-0.5 rounded-full shadow-xs shadow-amber-500/10",
                        x.rank === 2 && "bg-slate-400/15 text-slate-300 border border-slate-400/40 px-2 py-0.5 rounded-full",
                        x.rank === 3 && "bg-amber-700/15 text-amber-600 dark:text-amber-400 border border-amber-700/40 px-2 py-0.5 rounded-full",
                        x.rank > 3 && "text-muted-foreground px-2"
                      )}
                    >
                      {x.rank === 1 ? (
                        <Crown className="size-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                      ) : x.rank === 2 ? (
                        <Medal className="size-3.5 text-slate-300" />
                      ) : x.rank === 3 ? (
                        <Medal className="size-3.5 text-amber-600 dark:text-amber-400" />
                      ) : null}
                      #{x.rank}
                      {x.tied && <span className="ml-1 rounded bg-warning/20 px-1 text-[10px] text-warning font-mono">TIE</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">pending</span>
                  )}
                </td>
                <td className="p-3.5">
                  <Link
                    to="/teams/$id"
                    params={{ id: x.t.id }}
                    className="font-bold text-foreground hover:text-primary transition-colors"
                  >
                    {x.t.name}
                  </Link>
                </td>
                <td className="max-w-60 truncate p-3.5 text-xs text-muted-foreground">{x.t.project_title}</td>
                <td className="p-3.5 text-right font-mono">
                  <AnimatedNumber value={compPct(x.t, "pdf")} precision={1} />
                </td>
                <td className="p-3.5 text-right font-mono">
                  <AnimatedNumber value={compPct(x.t, "github")} precision={1} />
                </td>
                <td className="p-3.5 text-right font-mono">
                  <AnimatedNumber value={compPct(x.t, "website")} precision={1} />
                </td>
                <td className="p-3.5 text-right font-mono font-bold text-foreground">
                  {x.official ? (
                    <AnimatedNumber value={x.score} precision={1} className="text-primary" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      AI <AnimatedNumber value={x.t.aiFinal} precision={1} />
                    </span>
                  )}
                </td>
                <td className="p-3.5 pr-4">
                  <StatusBadge status={x.official ? "approved" : x.t.overall} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}
