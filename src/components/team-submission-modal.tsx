import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Github, Globe, ExternalLink, Download, Copy, Check, Eye } from "lucide-react";
import { type TeamRow } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  team: TeamRow | null;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "pdf" | "github" | "website";
}

export function TeamSubmissionModal({ team, isOpen, onClose, defaultTab = "pdf" }: Props) {
  const [activeTab, setActiveTab] = useState<"pdf" | "github" | "website">(defaultTab);
  const [copied, setCopied] = useState(false);

  const pdfUrlQuery = useQuery({
    queryKey: ["pdf-signed-url", team?.pdf_path],
    enabled: isOpen && !!team?.pdf_path,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.storage
          .from("project-pdfs")
          .createSignedUrl(team!.pdf_path!, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
      } catch {}
      return null;
    },
  });

  if (!team) return null;

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = (team.pdf_text || "").split(/\s+/).filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold">{team.name}</DialogTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  Submission Assets
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {team.project_title || "Project Submission Details & External Artifacts"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono text-muted-foreground">{team.email}</span>
            </div>
          </div>

          {/* Quick Access Badges Bar */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/30 text-xs">
            <span className="text-muted-foreground text-[11px] font-semibold">Direct Links:</span>
            {team.pdf_path || team.pdf_text ? (
              <Button
                variant={activeTab === "pdf" ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveTab("pdf")}
                className="h-7 text-xs gap-1.5"
              >
                <FileText className="size-3.5 text-rose-500" /> Project PDF
              </Button>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                No PDF
              </Badge>
            )}

            {team.github_url ? (
              <a
                href={team.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 hover:text-sky-500 transition-colors"
              >
                <Github className="size-3.5 text-sky-500" /> Open GitHub <ExternalLink className="size-3" />
              </a>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                No GitHub Repo
              </Badge>
            )}

            {team.website_url ? (
              <a
                href={team.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 hover:text-emerald-500 transition-colors"
              >
                <Globe className="size-3.5 text-emerald-500" /> Open Website <ExternalLink className="size-3" />
              </a>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[11px]">
                No Live Website
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Tabbed Content View */}
        <div className="flex-1 overflow-y-auto pt-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="pdf" className="text-xs flex items-center gap-1.5">
                <FileText className="size-3.5" /> PDF Document
              </TabsTrigger>
              <TabsTrigger value="github" className="text-xs flex items-center gap-1.5">
                <Github className="size-3.5" /> GitHub Code
              </TabsTrigger>
              <TabsTrigger value="website" className="text-xs flex items-center gap-1.5">
                <Globe className="size-3.5" /> Deployed Website
              </TabsTrigger>
            </TabsList>

            {/* PDF View */}
            <TabsContent value="pdf" className="space-y-3 mt-0">
              <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/60">
                <div className="flex items-center gap-2">
                  <FileText className="size-5 text-rose-500" />
                  <div>
                    <div className="font-semibold text-xs text-foreground">Project PDF Proposal / Deck</div>
                    <div className="text-[11px] text-muted-foreground">
                      {wordCount > 0 ? `${wordCount} words extracted` : "Uploaded document"}
                      {team.pdf_path ? ` · Path: ${team.pdf_path}` : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {pdfUrlQuery.data && (
                    <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
                      <a href={pdfUrlQuery.data} target="_blank" rel="noopener noreferrer">
                        <Download className="size-3" /> Open PDF File
                      </a>
                    </Button>
                  )}
                  {team.pdf_text && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyText(team.pdf_text!)}
                      className="h-7 text-xs gap-1"
                    >
                      {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                      {copied ? "Copied" : "Copy Text"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Text Preview */}
              {team.pdf_text ? (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Extracted Document Content
                  </div>
                  <div className="text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[45vh] overflow-y-auto rounded-lg bg-card/60 p-3 border border-border/40 text-foreground/90 select-text">
                    {team.pdf_text}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 p-8 text-center text-muted-foreground text-xs">
                  <FileText className="size-8 mx-auto mb-2 opacity-50" />
                  <p>No extracted text available for this team's PDF.</p>
                  {pdfUrlQuery.data && (
                    <a
                      href={pdfUrlQuery.data}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline mt-2 inline-block font-semibold"
                    >
                      Click here to download/view the original PDF file
                    </a>
                  )}
                </div>
              )}
            </TabsContent>

            {/* GitHub Code View */}
            <TabsContent value="github" className="space-y-4 mt-0">
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Github className="size-6 text-foreground" />
                    <div>
                      <div className="font-bold text-sm text-foreground">GitHub Source Repository</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {team.github_url || "No GitHub URL specified"}
                      </div>
                    </div>
                  </div>

                  {team.github_url && (
                    <Button size="sm" asChild className="gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold">
                      <a href={team.github_url} target="_blank" rel="noopener noreferrer">
                        Visit Repository <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  )}
                </div>

                {team.github_url ? (
                  <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-2 text-xs">
                    <div className="font-semibold text-foreground">Repository Evaluation Checklist:</div>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Check code quality, naming conventions, and linting standards.</li>
                      <li>Review modular directory hierarchy and architectural separation of concerns.</li>
                      <li>Verify core domain functionality and operational business logic.</li>
                      <li>Confirm setup instructions and setup scripts in the project README.md.</li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    The team has not submitted a GitHub repository link for code evaluation.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Website View */}
            <TabsContent value="website" className="space-y-4 mt-0">
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="size-6 text-emerald-500" />
                    <div>
                      <div className="font-bold text-sm text-foreground">Deployed Live Prototype</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {team.website_url || "No website URL specified"}
                      </div>
                    </div>
                  </div>

                  {team.website_url && (
                    <Button size="sm" asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                      <a href={team.website_url} target="_blank" rel="noopener noreferrer">
                        Open Live Website <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  )}
                </div>

                {team.website_url ? (
                  <div className="rounded-lg bg-muted/30 p-3 border border-border/40 space-y-2 text-xs">
                    <div className="font-semibold text-foreground">Live Deployment Verification:</div>
                    <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                      <li>Ensure responsive layout adapts cleanly across mobile, tablet, and desktop viewports.</li>
                      <li>Test interactive workflows, client forms, and live backend communication.</li>
                      <li>Assess visual design, typography, spacing, and micro-interaction responsiveness.</li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    The team has not submitted a live website or deployment URL.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="shrink-0 pt-3 border-t border-border/40 flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

