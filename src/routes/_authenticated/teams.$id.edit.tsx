import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TeamForm } from "@/components/team-form";
import { FadeIn } from "@/components/ui/motion-primitives";
import { getPersistentTeams, getPersistentMembers } from "@/lib/team-store";

export const Route = createFileRoute("/_authenticated/teams/$id/edit")({
  head: () => ({ meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }, { title: "Edit team — Assessor" }, { name: "description", content: "Edit team information." }, { property: "og:title", content: "Edit team — Assessor" }, { property: "og:description", content: "Edit team information." }] }),
  component: Edit,
});

function Edit() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["team-edit", id],
    queryFn: async () => {
      try {
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));
        const [t, m]: any = await Promise.race([
          Promise.all([supabase.from("teams").select("*").eq("id", id).single(), supabase.from("team_members").select("*").eq("team_id", id).order("position")]),
          timeout,
        ]);
        if (t?.data) {
          return { team: t.data, members: (m?.data ?? []).map((x: any) => ({ name: x.name, email: x.email ?? "" })) };
        }
      } catch {}

      const fallbackTeams = getPersistentTeams();
      const found = fallbackTeams.find((x) => x.id === id);
      const fallbackMembers = getPersistentMembers(id);
      if (found) {
        return { team: found, members: fallbackMembers };
      }
      return null;
    },
  });
  if (q.isLoading) return <div className="glass h-96 animate-pulse rounded-2xl" />;
  if (!q.data) return <div className="p-8 text-center text-muted-foreground">Team not found</div>;
  return (
    <FadeIn>
      <PageHeader title={`Edit ${q.data.team.name}`} />
      <TeamForm team={q.data.team} members={q.data.members} />
    </FadeIn>
  );
}
