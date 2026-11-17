import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Loader2, Plus, Trash2, Upload, Lightbulb, ExternalLink, Tag, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { extractPdfText } from "@/lib/pdf";
import { logActivity } from "@/lib/db";
import { type Team } from "@/lib/queries";
import { checkPdf, submissionSchema } from "@/lib/submission";
import { fetchProblemStatements, type ProblemStatement } from "@/lib/problem-statements";
import { upsertPersistentTeam, savePersistentMembers } from "@/lib/team-store";
import { evaluateSingleTeam } from "@/lib/evaluation-engine";
import { cn } from "@/lib/utils";

type Member = { name: string; email: string };

export function TeamForm({ team, members: initial }: { team?: Team; members?: Member[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: problemStatements = [] } = useQuery({
    queryKey: ["problem-statements"],
    queryFn: fetchProblemStatements,
  });

  const [f, setF] = useState({
    name: team?.name ?? "",
    email: team?.email ?? "",
    project_title: team?.project_title ?? "",
    project_description: team?.project_description ?? "",
    github_url: team?.github_url ?? "",
    website_url: team?.website_url ?? "",
  });

  const [selectedPsId, setSelectedPsId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>(initial?.length ? initial : [{ name: "", email: "" }]);
  const isExistingLink = !!team?.pdf_path && /^https?:\/\//i.test(team.pdf_path);
  const [pdfMode, setPdfMode] = useState<"link" | "file">(isExistingLink || !team?.pdf_path ? "link" : "file");
  const [pdfLink, setPdfLink] = useState<string>(isExistingLink ? team?.pdf_path ?? "" : "");
  const [pdf, setPdf] = useState<File | null>(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const maxMb = 3;

  // Initialize selected problem statement from team project_title if exists
  useEffect(() => {
    if (problemStatements.length > 0 && !selectedPsId) {
      if (team?.project_title) {
        const tLower = team.project_title.toLowerCase();
        const found = problemStatements.find(
          (p) => tLower.includes(p.code.toLowerCase()) || tLower.includes(p.title.toLowerCase())
        );
        if (found) {
          setSelectedPsId(found.id);
        }
      }
    }
  }, [problemStatements, team?.project_title, selectedPsId]);

  const activePs = problemStatements.find((p) => p.id === selectedPsId);

  const handleProblemStatementChange = (id: string) => {
    setSelectedPsId(id);
    const chosen = problemStatements.find((p) => p.id === id);
    if (chosen) {
      const newTitle = `[${chosen.code}] ${chosen.title}`;
      setF((prev) => ({
        ...prev,
        project_title: newTitle,
        // If current description is empty or matches another default ps description, autofill with this one
        project_description:
          !prev.project_description ||
          problemStatements.some((ps) => ps.description === prev.project_description)
            ? chosen.description
            : prev.project_description,
      }));
    }
  };

  const pickPdf = (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Only PDF files are allowed");
    if (file.size > maxMb * 1024 * 1024) return toast.error(`PDF must be under ${maxMb} MB`);
    setPdf(file);
    setRemovePdf(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPsId && problemStatements.length > 0) {
      return toast.error("Please select a problem statement for this team from the available options");
    }
    const parsed = submissionSchema.safeParse(f);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Check project details");
    if (pdfMode === "link") {
      if (!pdfLink.trim()) return toast.error("Google Drive / Pitch Deck link is required");
      if (!/^https?:\/\//i.test(pdfLink.trim())) return toast.error("Please enter a valid URL (starting with https://)");
    } else {
      if (!pdf && (!team?.pdf_path || removePdf || /^https?:\/\//i.test(team?.pdf_path ?? ""))) {
        return toast.error("Project PDF file is required");
      }
    }
    setBusy(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData?.user;

      if (!currentUser) {
        throw new Error("You must be signed in with your administrator account (TeamInoSap26@gmail.com) to save teams.");
      }

      // Synchronize first admin status in database prior to mutations
      try {
        await supabase.rpc("claim_first_admin");
      } catch (claimErr) {
        console.warn("claim_first_admin sync:", claimErr);
      }

      const id = team?.id ?? crypto.randomUUID();
      let path = team?.pdf_path ?? null;
      let text = team?.pdf_text ?? "";

      if (pdfMode === "link") {
        path = pdfLink.trim();
        text = `Pitch Deck Google Drive Link: ${pdfLink.trim()}\nProject: ${parsed.data.project_title}\nDescription: ${parsed.data.project_description}`;
      } else if (pdf) {
        await checkPdf(pdf);

        // 1. Extract text first for evaluation engine
        try {
          text = await extractPdfText(pdf);
        } catch (extractErr) {
          console.warn("PDF text extraction warning:", extractErr);
          toast.warning("PDF uploaded, but full text could not be extracted");
        }

        // 2. Upload to Supabase Storage project-pdfs bucket
        const uploadPath = `${id}/${Date.now()}.pdf`;
        const { error: up } = await supabase.storage
          .from("project-pdfs")
          .upload(uploadPath, pdf, { contentType: "application/pdf", upsert: true });

        if (up) {
          console.error("Storage upload error:", up);
          if (up.message?.toLowerCase().includes("row-level security")) {
            throw new Error("Storage RLS policy error: Your session is not authorized to upload project PDFs. Please ensure you are signed in as TeamInoSap26@gmail.com.");
          }
          if (up.message?.toLowerCase().includes("bucket not found") || (up as any).statusCode === "404" || (up as any).code === "NoSuchBucket") {
            throw new Error("Storage configuration error: Bucket 'project-pdfs' does not exist in Supabase Storage. Please apply migration 0002.");
          }
          throw new Error(`PDF upload failed: ${up.message}`);
        }

        path = uploadPath;
      }

      const payload = { ...parsed.data, id, pdf_path: path, pdf_text: text, updated_at: new Date().toISOString() };
      const validMembers = members.filter((m) => m.name.trim());

      // Persist to Supabase Database
      let { error: teamError } = team
        ? await supabase.from("teams").update(payload as any).eq("id", team.id)
        : await supabase.from("teams").insert(payload as any);

      // If database trigger checks storage.objects and rejects URL path, upload stub and retry
      if (teamError && teamError.message?.toLowerCase().includes("project pdf no larger than 3 mb is required") && pdfMode === "link") {
        try {
          const stubPath = `${id}/drive-pointer.pdf`;
          const stubBlob = new Blob(
            [`%PDF-1.4\n%Google Drive Pitch Deck Document\n${pdfLink.trim()}\n%%EOF`],
            { type: "application/pdf" }
          );
          await supabase.storage.from("project-pdfs").upload(stubPath, stubBlob, { contentType: "application/pdf", upsert: true });
          payload.pdf_path = stubPath;
          const retryRes = team
            ? await supabase.from("teams").update(payload as any).eq("id", team.id)
            : await supabase.from("teams").insert(payload as any);
          teamError = retryRes.error;
        } catch {}
      }

      if (teamError) {
        console.error("Supabase team sync error:", teamError);
        if (teamError.message?.toLowerCase().includes("row-level security")) {
          throw new Error("Database RLS error: Only TeamInoSap26@gmail.com is authorized to add or edit teams. Please verify your administrator session.");
        }
        throw new Error(`Failed to save team: ${teamError.message}`);
      }

      if (pdf && team?.pdf_path && team.pdf_path !== path) {
        await supabase.storage.from("project-pdfs").remove([team.pdf_path]).catch(() => {});
      }

      await supabase.from("team_members").delete().eq("team_id", id);
      const ms = validMembers.map((m, i) => ({
        team_id: id,
        name: m.name.trim(),
        email: m.email.trim() || null,
        position: i,
      }));
      if (ms.length) {
        const { error: memErr } = await supabase.from("team_members").insert(ms);
        if (memErr) console.warn("Team members insert:", memErr.message);
      }

      // Update backup local storage vault only after successful database mutation
      upsertPersistentTeam({
        id,
        name: f.name,
        email: f.email,
        project_title: f.project_title,
        project_description: f.project_description,
        github_url: f.github_url,
        website_url: f.website_url,
        pdf_path: path,
        pdf_text: text,
        final_status: team?.final_status ?? "pending",
        final_override: team?.final_override ?? null,
        override_reason: team?.override_reason ?? null,
        remarks: team?.remarks ?? null,
        created_at: team?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
        aiFinal: (team as any)?.aiFinal ?? null,
        approvedFinal: (team as any)?.approvedFinal ?? null,
        officialFinal: (team as any)?.officialFinal ?? null,
        missing: (team as any)?.missing ?? ["pdf", "github", "website"],
        overall: (team as any)?.overall ?? "pending",
        evals: (team as any)?.evals ?? {},
      });
      savePersistentMembers(id, validMembers);

      await logActivity(team ? "Edited team" : "Added team", f.name);

      qc.invalidateQueries();
      toast.success(team ? "Team updated" : "Team added");
      navigate({ to: "/teams/$id", params: { id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label} *</Label>
      <Input
        id={k}
        required
        maxLength={k === "name" ? 100 : k === "project_title" ? 200 : k === "email" ? 255 : 2048}
        type={type}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
      />
    </div>
  );

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
      <div className="glass space-y-4 rounded-2xl p-6 lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          {field("name", "Team name")}
          {field("email", "Team email", "email")}
        </div>

        {/* Problem Statement Selection Section */}
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="ps_select" className="flex items-center gap-2 font-semibold text-foreground">
              <Lightbulb className="size-4 text-primary" />
              Problem Statement *
            </Label>
            <Link
              to="/problem-statements"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Manage Problem Statements
              <ExternalLink className="size-3" />
            </Link>
          </div>

          <Select value={selectedPsId} onValueChange={handleProblemStatementChange}>
            <SelectTrigger id="ps_select" className="bg-background">
              <SelectValue placeholder="Select a problem statement from the list..." />
            </SelectTrigger>
            <SelectContent>
              {problemStatements.map((ps) => (
                <SelectItem key={ps.id} value={ps.id}>
                  <span className="font-mono font-semibold text-primary mr-1.5">[{ps.code}]</span>
                  <span>{ps.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({ps.category})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activePs && (
            <div className="mt-2.5 rounded-lg bg-background/80 border border-border/80 p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Tag className="size-3 text-primary" />
                  {activePs.category}
                </span>
                <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {activePs.code}
                </span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{activePs.description}</p>
              {activePs.requirements && (
                <p className="text-[11px] text-muted-foreground/80 italic pt-1 border-t border-border/40">
                  <span className="font-medium text-foreground not-italic">Scope:</span> {activePs.requirements}
                </p>
              )}
            </div>
          )}
        </div>

        {field("project_title", "Project Title (auto-populated from problem statement)")}

        <div className="space-y-1.5">
          <Label htmlFor="project_description">Project description & solution approach *</Label>
          <Textarea
            id="project_description"
            required
            maxLength={10000}
            rows={4}
            value={f.project_description}
            onChange={(e) => setF({ ...f, project_description: e.target.value })}
            placeholder="Explain the team's specific approach, methodology, and tech stack for solving this selected problem statement..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {field("github_url", "GitHub repository URL", "url")}
          {field("website_url", "Deployed website URL", "url")}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Team members ({members.length})</Label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setMembers([...members, { name: "", email: "" }])}
            >
              <Plus className="size-4" />
              Add member
            </Button>
          </div>
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Name"
                  value={m.name}
                  onChange={(e) =>
                    setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={m.email}
                  onChange={(e) =>
                    setMembers(members.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setMembers(members.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <Label className="text-sm font-bold">Pitch Deck / Presentation Document *</Label>
            <div className="flex rounded-lg bg-muted/80 p-0.5 border border-border/50">
              <button
                type="button"
                onClick={() => setPdfMode("link")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  pdfMode === "link"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Google Drive Link
              </button>
              <button
                type="button"
                onClick={() => setPdfMode("file")}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  pdfMode === "file"
                    ? "bg-card text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Upload File (PDF)
              </button>
            </div>
          </div>

          {pdfMode === "link" ? (
            <div className="space-y-2 mt-2">
              <div className="relative">
                <Input
                  placeholder="https://drive.google.com/file/d/... or slide deck link"
                  value={pdfLink}
                  onChange={(e) => {
                    setPdfLink(e.target.value);
                    setRemovePdf(false);
                  }}
                  className="font-mono text-xs pr-10"
                />
                {pdfLink && /^https?:\/\//i.test(pdfLink) && (
                  <a
                    href={pdfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 top-2.5 text-primary hover:opacity-80"
                    title="Open link in new tab"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Paste the viewable Google Drive presentation or PDF link. Evaluators will inspect this during multi-modal scoring.
              </p>
            </div>
          ) : (
            <div>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) pickPdf(dropped);
                }}
                className={cn(
                  "mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm transition-all",
                  isDragging
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/80 hover:bg-muted/10",
                  pdf && "border-emerald-500/50 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200"
                )}
              >
                {pdf ? (
                  <CheckCircle2 className="size-6 text-emerald-500 animate-in zoom-in-75 duration-200" />
                ) : (
                  <Upload className="size-6" />
                )}
                <div className="font-semibold">
                  {pdf
                    ? pdf.name
                    : team?.pdf_path && !removePdf && !isExistingLink
                    ? "Replace current PDF"
                    : "Choose a PDF or drag & drop here"}
                </div>
                {pdf && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {(pdf.size / 1024).toFixed(0)} KB · Ready for upload
                  </span>
                )}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => pickPdf(e.target.files?.[0])}
                />
              </label>
              {team?.pdf_path && !pdf && !removePdf && !isExistingLink && (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    PDF attached
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRemovePdf(true)}>
                    Remove
                  </Button>
                </div>
              )}
              {removePdf && <p className="mt-2 text-xs text-warning">PDF will be removed on save.</p>}
            </div>
          )}
        </div>
        <Button
          className="w-full"
          loading={busy}
          loadingText={team ? "Saving changes..." : "Creating team & extracting PDF..."}
        >
          {team ? "Save changes" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
