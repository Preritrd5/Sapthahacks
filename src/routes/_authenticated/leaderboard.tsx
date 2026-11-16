import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Trophy, Medal } from "lucide-react";
import { PageHeader, StatusBadge, fmt } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn } from "@/components/ui/motion-primitives";
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
                  "border-b border-border/40 hover:bg-muted/20 transition-colors",
                  !x.official && "opacity-75"
                )}
              >
                <td className="p-3.5 pl-4 font-display font-semibold">
                  {x.rank != null ? (
                    <span className={cn("inline-flex items-center gap-1", x.rank <= 3 && "text-primary font-bold")}>
                      {x.rank === 1 ? (
                        <Trophy className="size-3.5 text-amber-500 fill-amber-500/20" />
                      ) : x.rank <= 3 ? (
                        <Medal className="size-3.5 text-primary" />
                      ) : null}
                      #{x.rank}
                      {x.tied && <span className="ml-1 rounded bg-warning/20 px-1 text-[10px] text-warning">TIE</span>}
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
    </>
  );
}
