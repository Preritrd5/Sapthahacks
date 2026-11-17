import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { useSettings } from "@/lib/queries";
import { getStoredApiLogs, calculateTokenCost, type ApiUsageLog } from "@/lib/usage-logger";
import { useAuth } from "@/lib/auth-context";
import { StatCardSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion-primitives";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Gauge,
  Cpu,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Search,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/usage")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "API Usage Analytics — INNOVEDGE Assessor" },
      { name: "description", content: "Live recorded API usage logs, token consumption, model distribution, and estimated costs." },
      { property: "og:title", content: "API Usage Analytics — INNOVEDGE Assessor" },
      { property: "og:description", content: "Live recorded API usage logs, token consumption, model distribution, and estimated costs." },
    ],
  }),
  component: UsagePage,
});

const PIE_COLORS = ["#38bdf8", "#818cf8", "#34d399", "#f59e0b", "#f43f5e"];

function UsagePage() {
  const { user } = useAuth();
  const settings = useSettings();
  const [q, setQ] = useState("");
  const [componentFilter, setComponentFilter] = useState("all");

  // Query API logs from Supabase and merge with persistent vault (scoped by user ID)
  const usageQuery = useQuery({
    queryKey: ["api-usage-logs", user?.id],
    queryFn: async () => {
      let remoteLogs: any[] = [];
      try {
        const { data, error } = await supabase
          .from("api_usage_logs")
          .select("*, teams(name)")
          .order("created_at", { ascending: false })
          .limit(2000);
        if (!error && data) remoteLogs = data;
      } catch (e) {
        console.warn("Could not fetch remote API logs from Supabase:", e);
      }

      const localLogs = getStoredApiLogs(user?.id);

      // Merge and deduplicate by ID
      const map = new Map<string, ApiUsageLog>();

      // Put local logs first
      localLogs.forEach((l) => map.set(l.id, l));

      // Put remote logs, converting shape
      remoteLogs.forEach((r) => {
        const prompt_tokens = Number(r.prompt_tokens) || 0;
        const completion_tokens = Number(r.completion_tokens) || 0;
        const total_tokens = prompt_tokens + completion_tokens;
        const cost = calculateTokenCost(prompt_tokens, completion_tokens, r.model || "gemini-3.1-flash-lite");

        map.set(r.id, {
          id: r.id,
          model: r.model || "google/gemini-3.1-flash-lite",
          component: r.component || "general",
          team_id: r.team_id,
          team_name: r.teams?.name || null,
          status: r.status === "error" || r.status === "failed" ? "failed" : "success",
          http_status: Number(r.http_status) || 200,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          duration_ms: Number(r.duration_ms) || 0,
          estimated_cost_usd: cost,
          error: r.error,
          created_at: r.created_at,
        });
      });

      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return combined;
    },
    refetchInterval: 5000,
  });

  const logs = usageQuery.data ?? [];

  // Metrics computation from ACTUAL recorded logs
  const totalRequests = logs.length;
  const successfulRequests = logs.filter((l) => l.status === "success").length;
  const failedRequests = logs.filter((l) => l.status !== "success").length;

  const totalPromptTokens = logs.reduce((acc, l) => acc + (l.prompt_tokens || 0), 0);
  const totalCompletionTokens = logs.reduce((acc, l) => acc + (l.completion_tokens || 0), 0);
  const totalTokens = totalPromptTokens + totalCompletionTokens;

  const totalCostUsd = logs.reduce((acc, l) => acc + (l.estimated_cost_usd || 0), 0);

  // Model-wise API usage
  const modelUsage = useMemo(() => {
    const map = new Map<string, { requests: number; tokens: number; cost: number }>();
    logs.forEach((l) => {
      const model = l.model.replace(/^google\//, "");
      const curr = map.get(model) || { requests: 0, tokens: 0, cost: 0 };
      curr.requests += 1;
      curr.tokens += l.total_tokens;
      curr.cost += l.estimated_cost_usd;
      map.set(model, curr);
    });

    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      requests: data.requests,
      tokens: data.tokens,
      cost: Number(data.cost.toFixed(5)),
    }));
  }, [logs]);

  // Component-wise tokens
  const componentChartData = useMemo(() => {
    const map: Record<string, { prompt: number; completion: number }> = {
      pdf: { prompt: 0, completion: 0 },
      github: { prompt: 0, completion: 0 },
      website: { prompt: 0, completion: 0 },
    };

    logs.forEach((l) => {
      const c = l.component.toLowerCase();
      const entry = map[c];
      if (entry) {
        entry.prompt += l.prompt_tokens;
        entry.completion += l.completion_tokens;
      }
    });

    const pdf = map["pdf"] ?? { prompt: 0, completion: 0 };
    const github = map["github"] ?? { prompt: 0, completion: 0 };
    const website = map["website"] ?? { prompt: 0, completion: 0 };

    return [
      { name: "PDF Deck", prompt: pdf.prompt, completion: pdf.completion },
      { name: "GitHub Code", prompt: github.prompt, completion: github.completion },
      { name: "Website", prompt: website.prompt, completion: website.completion },
    ];
  }, [logs]);

  // Activity by hour for today
  const hourlyData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayLogs = logs.filter((l) => new Date(l.created_at).getTime() >= today);

    return Array.from({ length: 24 }, (_, h) => {
      const countOk = todayLogs.filter(
        (l) => new Date(l.created_at).getUTCHours() === h && l.status === "success"
      ).length;
      const countErr = todayLogs.filter(
        (l) => new Date(l.created_at).getUTCHours() === h && l.status !== "success"
      ).length;
      return {
        hour: `${h}:00`,
        success: countOk,
        failed: countErr,
      };
    });
  }, [logs]);

  // Filtered Logs for Evaluation-wise table
  const filteredLogs = useMemo(() => {
    const s = q.toLowerCase();
    return logs.filter((l) => {
      const matchesSearch =
        !s ||
        l.component.toLowerCase().includes(s) ||
        l.model.toLowerCase().includes(s) ||
        (l.team_name && l.team_name.toLowerCase().includes(s)) ||
        (l.error && l.error.toLowerCase().includes(s));

      const matchesComp = componentFilter === "all" || l.component.toLowerCase() === componentFilter;
      return matchesSearch && matchesComp;
    });
  }, [logs, q, componentFilter]);

  return (
    <>
      <FadeIn>
        <PageHeader
          title="API Usage Analytics"
          desc={`Live metrics calculated directly from ${totalRequests} recorded API evaluation calls.`}
        />
      </FadeIn>

      {/* Top 5 Interactive 3D Metric Cards */}
      {usageQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <StaggerContainer className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-5">
          <StaggerItem>
            <GlassCard3D glowColor="primary" className="group">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-2 pt-0.5">
                <span className="leading-normal">Total Requests</span>
                <div className="size-7 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                  <Gauge className="size-3.5" />
                </div>
              </div>
              <div className="my-2.5 font-mono text-2xl font-bold">{totalRequests.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground pb-0.5">Recorded AI calls</div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D glowColor="emerald" className="group">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 flex items-center justify-between gap-2 pt-0.5">
                <span className="leading-normal">Success Rate</span>
                <div className="size-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 grid place-items-center text-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="size-3.5" />
                </div>
              </div>
              <div className="my-2.5 font-mono text-2xl font-bold text-emerald-500">
                {totalRequests ? Math.round((successfulRequests / totalRequests) * 100) : 100}%
              </div>
              <div className="text-[11px] text-muted-foreground pb-0.5">
                {successfulRequests} ok / {failedRequests} failed
              </div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D glowColor="sky" className="group">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-2 pt-0.5">
                <span className="leading-normal">Total Tokens</span>
                <div className="size-7 rounded-lg bg-sky-500/15 border border-sky-500/30 grid place-items-center text-sky-500 shrink-0 group-hover:scale-110 transition-transform">
                  <Zap className="size-3.5" />
                </div>
              </div>
              <div className="my-2.5 font-mono text-2xl font-bold">{totalTokens.toLocaleString()}</div>
              <div className="text-[11px] text-muted-foreground pb-0.5">
                In: {totalPromptTokens.toLocaleString()} · Out: {totalCompletionTokens.toLocaleString()}
              </div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D glowColor="amber" className="group">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center justify-between gap-2 pt-0.5">
                <span className="leading-normal">Active Model</span>
                <div className="size-7 rounded-lg bg-amber-500/15 border border-amber-500/30 grid place-items-center text-amber-500 shrink-0 group-hover:scale-110 transition-transform">
                  <Cpu className="size-3.5" />
                </div>
              </div>
              <div className="my-2.5 font-mono text-sm font-bold text-foreground truncate">
                {settings.data?.model?.replace(/^google\//, "") || "gemini-3.1-flash-lite"}
              </div>
              <div className="text-[11px] text-muted-foreground pb-0.5">Google Gemini Direct</div>
            </GlassCard3D>
          </StaggerItem>

          <StaggerItem>
            <GlassCard3D glowColor="terracotta" className="group">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center justify-between gap-2 pt-0.5">
                <span className="leading-normal">Estimated Cost</span>
                <div className="size-7 rounded-lg bg-primary/15 border border-primary/30 grid place-items-center text-primary shrink-0 group-hover:scale-110 transition-transform">
                  <Coins className="size-3.5" />
                </div>
              </div>
              <div className="my-2.5 font-mono text-2xl font-bold text-primary">
                ${totalCostUsd.toFixed(4)}
              </div>
              <div className="text-[11px] text-muted-foreground pb-0.5">Calculated Gemini rates</div>
            </GlassCard3D>
          </StaggerItem>
        </StaggerContainer>
      )}

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        {/* Token Consumption by Evaluation Component */}
        <div className="glass rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
            Token Consumption by Evaluation Component
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={componentChartData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                <Bar dataKey="prompt" name="Prompt Tokens" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completion" name="Completion Tokens" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Evaluation Activity (Today UTC) */}
        <div className="glass rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
            Hourly Evaluation Activity (Today UTC)
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="success" name="Successful Requests" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" name="Failed / Rate-Limited" fill="#f43f5e" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model-wise API Usage Breakdown */}
      <div className="glass rounded-2xl p-5 mb-6">
        <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
          Model-wise API Usage & Cost Breakdown
        </div>
        {!modelUsage.length ? (
          <div className="text-xs text-muted-foreground py-4 text-center">No model usage recorded yet.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {modelUsage.map((m, idx) => (
              <div key={m.name} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-primary" />
                  <span className="font-mono text-xs font-bold text-foreground">{m.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/40 text-center">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Requests</div>
                    <div className="font-mono text-sm font-semibold">{m.requests}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Tokens</div>
                    <div className="font-mono text-sm font-semibold">{m.tokens.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Cost</div>
                    <div className="font-mono text-sm font-semibold text-primary">${m.cost}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evaluation-wise API Consumption Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-foreground text-sm">Evaluation-wise API Consumption Logs</h3>
            <p className="text-xs text-muted-foreground">
              Every request is logged with token consumption, duration, and status.
            </p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="pl-8 text-xs h-8"
                placeholder="Search logs..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <Select value={componentFilter} onValueChange={setComponentFilter}>
              <SelectTrigger className="w-36 text-xs h-8">
                <SelectValue placeholder="Component" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Components</SelectItem>
                <SelectItem value="pdf">PDF Deck</SelectItem>
                <SelectItem value="github">GitHub Code</SelectItem>
                <SelectItem value="website">Website</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="glass overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-xs">
            <thead className="text-left uppercase text-muted-foreground bg-muted/30">
              <tr className="border-b border-border/80">
                <th className="p-3 pl-4">Timestamp</th>
                <th className="p-3">Team / Context</th>
                <th className="p-3">Component</th>
                <th className="p-3">Model</th>
                <th className="p-3 text-right">Prompt Tokens</th>
                <th className="p-3 text-right">Completion</th>
                <th className="p-3 text-right">Latency</th>
                <th className="p-3 text-right">Cost</th>
                <th className="p-3 pr-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {!filteredLogs.length ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No recorded API requests found. Run evaluations from the Dashboard to record live logs.
                  </td>
                </tr>
              ) : (
                filteredLogs.slice(0, 150).map((log) => (
                  <tr key={log.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-3 pl-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString()} · {new Date(log.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 font-semibold text-foreground max-w-48 truncate">
                      {log.team_name || (log.team_id ? `Team ${log.team_id.slice(0, 8)}` : "System / Direct")}
                    </td>
                    <td className="p-3 uppercase font-mono text-[10px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">{log.component}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground truncate max-w-36">
                      {log.model.replace(/^google\//, "")}
                    </td>
                    <td className="p-3 text-right font-mono">{log.prompt_tokens.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{log.completion_tokens.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(2)}s` : "—"}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-primary">
                      ${log.estimated_cost_usd.toFixed(5)}
                    </td>
                    <td className="p-3 pr-4 text-center">
                      {log.status === "success" ? (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">
                          200 OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]" title={log.error || ""}>
                          Error
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
