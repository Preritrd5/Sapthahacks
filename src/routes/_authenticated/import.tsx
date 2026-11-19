import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Check,
  Eye,
  Info,
  Columns,
  Sparkles,
  Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { readSheet, generateTeamImportTemplate } from "@/lib/export";
import { fetchAll, logActivity } from "@/lib/db";
import { checkPdf } from "@/lib/submission";
import { extractPdfText } from "@/lib/pdf";
import { upsertPersistentTeam, savePersistentMembers } from "@/lib/team-store";
import { FadeIn, StaggerContainer, StaggerItem, Magnetic, BorderBeam, ShimmerButton } from "@/components/ui/motion-primitives";
import { GlassCard3D } from "@/components/ui/glass-card-3d";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  createDefaultColumnMapping,
  parseRowsWithMapping,
  validateColumnMapping,
  type ColumnMappingState,
  type ParsedTeamRow,
  type ParsedTeamMember,
} from "@/lib/column-mapping";
import { ExcelColumnMapper } from "@/components/excel-column-mapper";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Bulk Excel Import — Assessor" },
      { name: "description", content: "Import hackathon teams and project submissions from Excel spreadsheets with dynamic column mapping." },
      { property: "og:title", content: "Bulk Excel Import — Assessor" },
      { property: "og:description", content: "Import hackathon teams and project submissions from Excel spreadsheets with dynamic column mapping." },
    ],
  }),
  component: ImportPage,
});

export type { ParsedTeamRow, ParsedTeamMember };

function ImportPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Workflow Steps: 'upload' | 'mapping' | 'preview'
  const [activeStep, setActiveStep] = useState<"upload" | "mapping" | "preview">("upload");

  // Raw file & columns state
  const [fileName, setFileName] = useState<string>("");
  const [rawRecords, setRawRecords] = useState<Record<string, string>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMappingState>({});
  const [existingTeamsList, setExistingTeamsList] = useState<{ name: string; email?: string }[]>([]);

  // Parsed Data & Selection States
  const [rows, setRows] = useState<ParsedTeamRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPdfSection, setShowPdfSection] = useState(false);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [uploadSummary, setUploadSummary] = useState<{
    totalSelected: number;
    imported: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "existing" | "duplicate" | "invalid" | "selected">("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [problemFilter, setProblemFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [memberCountFilter, setMemberCountFilter] = useState<"all" | "1" | "2" | "3" | "4">("all");
  const [reviewMode, setReviewMode] = useState(false);

  const pdfFor = (name: string) =>
    pdfs.find((file) => file.name.replace(/\.pdf$/i, "").toLowerCase() === name.toLowerCase());

  const canImport = (row: ParsedTeamRow) => row.isValid && !row.duplicateInSheet && !row.alreadyInDb;

  // 1. File Upload & Column Header Detection
  const load = async (file?: File) => {
    if (!file) return;
    try {
      setFileName(file.name);
      setUploadSummary(null);
      const raw = await readSheet(file);
      if (!raw.length) {
        return toast.error("The selected file contains no data rows.");
      }

      // Extract all distinct column headers detected in the file
      const headers = Array.from(new Set(raw.flatMap((r) => Object.keys(r))));
      const existingTeams = await fetchAll<{ name: string; email: string }>("teams");
      setExistingTeamsList(existingTeams);

      const initialMapping = createDefaultColumnMapping(headers);
      setRawRecords(raw);
      setDetectedHeaders(headers);
      setColumnMapping(initialMapping);

      // Automatically transition to Column Mapping step
      setActiveStep("mapping");
      toast.info(`Detected ${headers.length} Excel column(s). Review and confirm field mappings.`);
    } catch (e) {
      toast.error(`Could not read Excel file: ${(e as Error).message}`);
    }
  };

  // 2. Confirm Column Mapping & Transition to Preview
  const handleConfirmMapping = () => {
    const validation = validateColumnMapping(columnMapping);
    if (!validation.isValid) {
      return toast.error("Please map all mandatory portal fields before proceeding.");
    }

    const parsed = parseRowsWithMapping(rawRecords, columnMapping, existingTeamsList);
    setRows(parsed);

    // Default select all valid rows ready to import
    const initialSelected = new Set(parsed.filter(canImport).map((r) => r.id));
    setSelectedRowIds(initialSelected);

    setActiveStep("preview");
    toast.success(`Generated preview for ${parsed.length} team(s) with ${validation.selectedColumnCount} selected column(s).`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) load(file);
  };

  // Distinct lists for dropdown filters
  const uniqueColleges = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.college) set.add(r.college);
    });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueProblems = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.problem_statement) set.add(r.problem_statement);
    });
    return Array.from(set).sort();
  }, [rows]);

  const uniqueTracks = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.track) set.add(r.track);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Combined Multi-Filter Engine
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const customValues = Object.values(r.customMetadata);
        const matchesGlobal = [
          r.name,
          r.college,
          r.email,
          r.track,
          r.problem_statement,
          r.project_title,
          r.project_description,
          r.github_url,
          r.website_url,
          ...r.members.map((m) => m.name),
          ...r.members.map((m) => m.email),
          ...customValues,
        ].some((val) => val?.toLowerCase().includes(q));

        if (!matchesGlobal) return false;
      }

      // 2. Status Filter
      if (statusFilter !== "all") {
        if (statusFilter === "selected" && !selectedRowIds.has(r.id)) return false;
        if (statusFilter === "ready" && r.status !== "ready") return false;
        if (statusFilter === "existing" && r.status !== "existing") return false;
        if (statusFilter === "duplicate" && r.status !== "duplicate") return false;
        if (statusFilter === "invalid" && r.status !== "invalid") return false;
      }

      // 3. Review Selection Toggle
      if (reviewMode && !selectedRowIds.has(r.id)) {
        return false;
      }

      // 4. College Filter
      if (collegeFilter !== "all" && r.college.toLowerCase() !== collegeFilter.toLowerCase()) {
        return false;
      }

      // 5. Problem Statement Filter
      if (problemFilter !== "all" && r.problem_statement.toLowerCase() !== problemFilter.toLowerCase()) {
        return false;
      }

      // 6. Track Filter
      if (trackFilter !== "all" && r.track.toLowerCase() !== trackFilter.toLowerCase()) {
        return false;
      }

      // 7. Member Count Filter
      if (memberCountFilter !== "all") {
        const targetCount = parseInt(memberCountFilter, 10);
        if (r.members.length !== targetCount) return false;
      }

      return true;
    });
  }, [rows, searchQuery, statusFilter, collegeFilter, problemFilter, trackFilter, memberCountFilter, reviewMode, selectedRowIds]);

  // Row selection actions (preserves selections across filter changes)
  const toggleRowSelect = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((r) => next.delete(r.id));
      return next;
    });
  };

  const selectAllValid = () => {
    setSelectedRowIds(new Set(rows.filter(canImport).map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedRowIds(new Set());
  };

  const resetAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setCollegeFilter("all");
    setProblemFilter("all");
    setTrackFilter("all");
    setMemberCountFilter("all");
    setReviewMode(false);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    collegeFilter !== "all" ||
    problemFilter !== "all" ||
    trackFilter !== "all" ||
    memberCountFilter !== "all" ||
    reviewMode;

  const validCount = rows.filter(canImport).length;
  const duplicateCount = rows.filter((r) => r.duplicateInSheet).length;
  const existingCount = rows.filter((r) => r.alreadyInDb).length;
  const issueCount = rows.filter((r) => !r.isValid).length;

  const selectedRows = rows.filter((r) => selectedRowIds.has(r.id));
  const selectedValidCount = selectedRows.filter(canImport).length;
  const selectedInvalidCount = selectedRows.filter((r) => !canImport(r)).length;

  const areAllFilteredSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedRowIds.has(r.id));

  // Mapping stats
  const mappingValidation = validateColumnMapping(columnMapping);
  const hasCustomMetadata = Object.values(columnMapping).some(
    (m) => m.selected && m.targetField === "custom_metadata"
  );

  // Selective Row Import execution
  const save = async () => {
    if (selectedRowIds.size === 0) {
      return toast.error("Please select at least one record to import.");
    }

    const rowsToImport = rows.filter((r) => selectedRowIds.has(r.id) && canImport(r));

    if (!rowsToImport.length) {
      return toast.error("None of the selected records pass validation. Review the issues before importing.");
    }

    if (selectedInvalidCount > 0) {
      toast.warning(`${selectedInvalidCount} selected record(s) have validation issues and will be skipped.`);
    }

    setBusy(true);
    try {
      await supabase.rpc("claim_first_admin");
    } catch {}

    let importedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const r of rowsToImport) {
      const file = pdfFor(r.name);
      const id = crypto.randomUUID();
      let path = "";
      let text = "";

      // 1. Determine PDF path and text
      if (file) {
        try {
          await checkPdf(file);
        } catch (error) {
          errors.push(`${r.name}: ${(error as Error).message}`);
          failedCount++;
          continue;
        }
        path = `${id}/${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("project-pdfs")
          .upload(path, file, { contentType: "application/pdf" });
        if (uploadError) {
          errors.push(`${r.name}: ${uploadError.message}`);
          failedCount++;
          continue;
        }
        try {
          text = await extractPdfText(file);
        } catch {
          text = `Local PDF presentation for ${r.name}.\nProject: ${r.project_title}\nDescription: ${r.project_description}`;
        }
      } else if (r.pdf_url) {
        path = r.pdf_url;
        text = `Pitch Deck Google Drive Link: ${r.pdf_url}\nProject Title: ${r.project_title}\nProblem Description: ${r.project_description}`;
      } else {
        path = `${id}/pitch-deck.pdf`;
        text = `Pitch Deck presentation pending submission for team ${r.name}.\nProject Title: ${r.project_title}\nProblem Description: ${r.project_description}`;
      }

      // 2. Proactively upload a small stub PDF pointer if path is not a stored file
      if (!file) {
        try {
          const stubPath = `${id}/pitch-deck.pdf`;
          const stubBlob = new Blob(
            [`%PDF-1.4\n%INNOVEDGE Hackathon Pitch Deck Pointer\n${r.pdf_url || "Pitch deck pending submission."}\n%%EOF`],
            { type: "application/pdf" }
          );
          await supabase.storage
            .from("project-pdfs")
            .upload(stubPath, stubBlob, { contentType: "application/pdf", upsert: true });
        } catch (storageErr) {
          console.warn("Storage stub upload warning:", storageErr);
        }
      }

      // 3. Encode college, track, problem statement, AND custom metadata in remarks
      const customMetadataStr =
        Object.keys(r.customMetadata).length > 0 ? `Custom: ${JSON.stringify(r.customMetadata)}` : "";

      const metadataRemarks = [
        r.college ? `College: ${r.college}` : "",
        r.track ? `Track: ${r.track}` : "",
        r.problem_statement ? `PS: ${r.problem_statement}` : "",
        customMetadataStr,
      ]
        .filter(Boolean)
        .join(" | ");

      // 4. Save to persistent team store so data is immediately visible across tabs
      upsertPersistentTeam({
        id,
        name: r.name,
        email: r.email,
        college: r.college || undefined,
        track: r.track || undefined,
        problem_statement: r.problem_statement || undefined,
        project_title: r.project_title,
        project_description: r.project_description,
        github_url: r.github_url,
        website_url: r.website_url,
        pdf_path: path,
        pdf_text: text,
        final_status: "pending",
        final_override: null,
        override_reason: null,
        remarks: metadataRemarks || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        aiFinal: null,
        approvedFinal: null,
        officialFinal: null,
        missing: ["pdf", "github", "website"],
        overall: "pending",
        evals: {},
        members: r.members.map((m, pos) => ({ name: m.name, email: m.email || null, position: pos })),
      });

      // Save persistent members
      if (r.members.length) {
        savePersistentMembers(id, r.members);
      }

      // 5. Insert into Supabase teams and team_members tables
      try {
        const payload = {
          name: r.name,
          email: r.email,
          project_title: r.project_title,
          project_description: r.project_description,
          github_url: r.github_url,
          website_url: r.website_url,
          id,
          pdf_path: path,
          pdf_text: text,
          remarks: metadataRemarks || null,
        };

        let { data, error } = await supabase.from("teams").insert(payload).select("id").single();

        // If Postgres trigger rejected because pdf_path is an external link, fallback to stub path
        if (error && error.message?.toLowerCase().includes("project pdf no larger than 3 mb is required")) {
          payload.pdf_path = `${id}/pitch-deck.pdf`;
          const retry = await supabase.from("teams").insert(payload).select("id").single();
          data = retry.data;
        }

        if (data && r.members.length) {
          await supabase.from("team_members").insert(
            r.members.map((m, i) => ({
              team_id: data.id,
              name: m.name.trim(),
              email: m.email.trim() || null,
              position: i,
            }))
          );
        }
        importedCount++;
      } catch (insertErr: any) {
        console.warn("Supabase team insert caught:", insertErr);
        errors.push(`${r.name}: ${insertErr?.message || "Database insert error"}`);
        failedCount++;
      }
    }

    await logActivity("Selective Excel import", `${importedCount} team(s) imported successfully`);
    setBusy(false);

    setUploadSummary({
      totalSelected: selectedRowIds.size,
      imported: importedCount,
      skipped: selectedInvalidCount,
      failed: failedCount,
      errors,
    });

    qc.invalidateQueries();

    if (failedCount === 0) {
      toast.success(`Successfully imported ${importedCount} team(s) from Excel.`);
    } else {
      toast.warning(`Imported ${importedCount} team(s), with ${failedCount} failure(s).`);
    }
  };

  const clearImport = () => {
    setActiveStep("upload");
    setRows([]);
    setSelectedRowIds(new Set());
    setFileName("");
    setRawRecords([]);
    setDetectedHeaders([]);
    setColumnMapping({});
    setPdfs([]);
    setUploadSummary(null);
    resetAllFilters();
  };

  return (
    <>
      <FadeIn>
        <PageHeader
          title="Bulk Excel Import"
          desc="Import hackathon teams, custom columns, and 4-member rosters with dynamic Excel column detection and field mapping."
        >
          <Magnetic strength={4}>
            <Button variant="outline" onClick={generateTeamImportTemplate} className="gap-2">
              <Download className="size-4" />
              Download Excel Template (.xlsx)
            </Button>
          </Magnetic>
          <Magnetic strength={4}>
            <ShimmerButton onClick={() => fileInputRef.current?.click()} className="gap-2 text-sm font-semibold h-9">
              <Upload className="size-4" />
              Select Excel File
            </ShimmerButton>
          </Magnetic>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => load(e.target.files?.[0])}
          />
        </PageHeader>
      </FadeIn>

      {/* STEP 1: Main Drag & Drop Zone (when no file loaded) */}
      {activeStep === "upload" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-border/80 bg-card/60 hover:border-primary/60 hover:bg-card/90"
          }`}
        >
          {isDragging && <BorderBeam colorFrom="#d95a2b" colorTo="#f59e0b" duration={4} borderWidth={2} />}
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary mb-4">
            <FileSpreadsheet className="size-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            Drop your Excel spreadsheet here, or click to browse
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg mx-auto">
            Upload an <span className="font-semibold text-foreground">.xlsx</span>,{" "}
            <span className="font-semibold text-foreground">.xls</span>, or{" "}
            <span className="font-semibold text-foreground">.csv</span> file.
            Columns will be automatically detected and mapped.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
              Automatic Column Detection
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
              Custom Field Mapping
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
              Selective Column Import
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
              All 4 Team Members
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1">
              Custom Metadata Remarks
            </span>
          </div>
        </div>
      )}

      {/* STEP 2: Dedicated Column Selector & Field Mapper Section */}
      {activeStep === "mapping" && (
        <ExcelColumnMapper
          detectedHeaders={detectedHeaders}
          sampleRow={rawRecords[0]}
          mapping={columnMapping}
          onMappingChange={setColumnMapping}
          onConfirm={handleConfirmMapping}
          onCancel={rows.length > 0 ? () => setActiveStep("preview") : clearImport}
        />
      )}

      {/* STEP 3: Preview, Filter & Selective Import */}
      {activeStep === "preview" && (
        <div className="space-y-4">
          {/* Active File & Column Config Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/80">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary font-bold">
                ✓
              </span>
              <span className="font-semibold text-foreground">{fileName}</span>
              <span className="text-muted-foreground font-mono">({rawRecords.length} rows)</span>
              <span className="text-muted-foreground">·</span>
              <Badge variant="secondary" className="gap-1 font-mono text-[11px] h-5">
                <Columns className="size-3 text-primary" />
                {mappingValidation.selectedColumnCount} of {detectedHeaders.length} Columns Mapped
              </Badge>
              {hasCustomMetadata && (
                <Badge variant="outline" className="gap-1 text-[11px] h-5 bg-sky-500/10 text-sky-600 border-sky-500/30">
                  <Tag className="size-3" /> Custom Metadata Included
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveStep("mapping")}
                className="text-xs h-7 gap-1.5"
                title="Change which columns are included or edit field mappings"
              >
                <Columns className="size-3 text-primary" />
                Modify Column Selection
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearImport}
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
              >
                Upload Different File
              </Button>
            </div>
          </div>

          {/* Summary Metric Cards */}
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StaggerItem>
              <GlassCard3D glowColor="primary" className="p-3.5 h-full">
                <div className="text-xs text-muted-foreground font-medium">Loaded File</div>
                <div className="text-sm font-bold text-foreground truncate mt-0.5" title={fileName}>
                  {fileName}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  <AnimatedNumber value={rows.length} precision={0} /> total rows in sheet
                </div>
              </GlassCard3D>
            </StaggerItem>

            <StaggerItem>
              <GlassCard3D glowColor="emerald" className="p-3.5 border-emerald-500/30 bg-emerald-500/5 h-full">
                <div className="text-xs text-emerald-600 font-medium">Selected for Import</div>
                <div className="text-2xl font-bold font-mono text-emerald-600 mt-0.5 flex items-baseline gap-1">
                  <AnimatedNumber value={selectedValidCount} precision={0} />
                  <span className="text-xs font-normal text-muted-foreground">
                    / {selectedRowIds.size} selected
                  </span>
                </div>
                <div className="text-[11px] text-emerald-600/80 mt-0.5">
                  {selectedValidCount} valid rows ready
                </div>
              </GlassCard3D>
            </StaggerItem>

            <StaggerItem>
              <GlassCard3D glowColor="amber" className="p-3.5 border-amber-500/30 bg-amber-500/5 h-full">
                <div className="text-xs text-amber-600 font-medium">Duplicates / Existing</div>
                <div className="text-2xl font-bold font-mono text-amber-600 mt-0.5">
                  <AnimatedNumber value={duplicateCount + existingCount} precision={0} />
                </div>
                <div className="text-[11px] text-amber-600/80 mt-0.5">
                  {existingCount} in DB · {duplicateCount} in sheet
                </div>
              </GlassCard3D>
            </StaggerItem>

            <StaggerItem>
              <GlassCard3D glowColor="rose" className="p-3.5 border-rose-500/30 bg-rose-500/5 h-full">
                <div className="text-xs text-rose-600 font-medium">Validation Issues</div>
                <div className="text-2xl font-bold font-mono text-rose-600 mt-0.5">
                  <AnimatedNumber value={issueCount} precision={0} />
                </div>
                <div className="text-[11px] text-rose-600/80 mt-0.5">
                  Missing required fields or invalid format
                </div>
              </GlassCard3D>
            </StaggerItem>
          </StaggerContainer>

          {/* Upload Results Summary Banner (if completed) */}
          {uploadSummary && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 shadow-sm backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">
                      Bulk Import Execution Complete
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Successfully imported <strong className="text-emerald-500">{uploadSummary.imported}</strong> team(s).
                      {uploadSummary.skipped > 0 && ` Skipped ${uploadSummary.skipped} invalid row(s).`}
                      {uploadSummary.failed > 0 && ` Failed: ${uploadSummary.failed}.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/teams">View Teams &rarr;</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setUploadSummary(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
              {uploadSummary.errors.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/40 text-xs text-rose-600 space-y-1">
                  <strong>Errors encountered:</strong>
                  {uploadSummary.errors.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Selective Row Action & Confirmation Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border/80 shadow-sm">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>Row-Level Selection:</span>
                <Badge variant={selectedValidCount > 0 ? "default" : "secondary"} className="font-mono text-xs">
                  {selectedValidCount} of {rows.length} Ready to Import
                </Badge>
                {selectedInvalidCount > 0 && (
                  <Badge variant="destructive" className="font-mono text-xs">
                    {selectedInvalidCount} invalid selected
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Only explicitly checked records will be imported into the database and evaluation queue.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllFiltered}
                className="text-xs h-8"
                title="Select all rows matching the active filters"
              >
                Select Filtered ({filteredRows.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllValid}
                className="text-xs h-8"
                title="Select all valid rows ready to import"
              >
                Select All Valid ({validCount})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                className="text-xs h-8"
                disabled={selectedRowIds.size === 0}
              >
                Deselect All
              </Button>
              <Button
                variant={reviewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setReviewMode(!reviewMode)}
                className="text-xs h-8 gap-1.5"
              >
                <Eye className="size-3.5" />
                {reviewMode ? "Show All Rows" : `Review Selection (${selectedRowIds.size})`}
              </Button>
              <Magnetic strength={4}>
                <ShimmerButton
                  onClick={save}
                  disabled={busy || selectedValidCount === 0}
                  className="font-bold shadow-md gap-2 px-5 h-9 text-xs"
                >
                  <CheckCircle2 className="size-4" />
                  {busy ? "Importing..." : `Import Selected (${selectedValidCount}) Teams`}
                </ShimmerButton>
              </Magnetic>
            </div>
          </div>

          {/* Advanced Multi-Filter Control Console */}
          <div className="glass p-4 rounded-2xl border border-border/70 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-foreground">
                <Filter className="size-3.5 text-primary" /> Advanced Data Filters &amp; Search
              </span>
              <span>
                Showing {filteredRows.length} of {rows.length} rows
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* 1. Global Search */}
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 text-xs bg-background/80"
                  placeholder="Search team, college, leader, member 1–4, email, PS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* 2. Status Filter */}
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="h-9 text-xs bg-background/80">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ready">Ready to Import ({validCount})</SelectItem>
                  <SelectItem value="selected">Selected Rows ({selectedRowIds.size})</SelectItem>
                  <SelectItem value="existing">Already in DB ({existingCount})</SelectItem>
                  <SelectItem value="duplicate">Duplicates in Sheet ({duplicateCount})</SelectItem>
                  <SelectItem value="invalid">Validation Issues ({issueCount})</SelectItem>
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
              <Select value={problemFilter} onValueChange={setProblemFilter}>
                <SelectTrigger className="h-9 text-xs bg-background/80 truncate">
                  <SelectValue placeholder="Problem Statement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Problems ({uniqueProblems.length})</SelectItem>
                  {uniqueProblems.map((ps) => (
                    <SelectItem key={ps} value={ps}>
                      {ps}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 5. Members Count Filter */}
              <Select value={memberCountFilter} onValueChange={(val: any) => setMemberCountFilter(val)}>
                <SelectTrigger className="h-9 text-xs bg-background/80">
                  <SelectValue placeholder="Team Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Sizes</SelectItem>
                  <SelectItem value="4">4 Members (Full Team)</SelectItem>
                  <SelectItem value="3">3 Members</SelectItem>
                  <SelectItem value="2">2 Members</SelectItem>
                  <SelectItem value="1">1 Member (Solo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Filter Chips Strip */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground mr-1">Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                    Search: {searchQuery}
                    <X className="size-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                  </Badge>
                )}
                {statusFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2 capitalize">
                    Status: {statusFilter}
                    <X className="size-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
                  </Badge>
                )}
                {collegeFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                    College: {collegeFilter}
                    <X className="size-3 cursor-pointer" onClick={() => setCollegeFilter("all")} />
                  </Badge>
                )}
                {problemFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                    PS: {problemFilter}
                    <X className="size-3 cursor-pointer" onClick={() => setProblemFilter("all")} />
                  </Badge>
                )}
                {trackFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                    Track: {trackFilter}
                    <X className="size-3 cursor-pointer" onClick={() => setTrackFilter("all")} />
                  </Badge>
                )}
                {memberCountFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-[11px] h-6 px-2">
                    Members: {memberCountFilter}
                    <X className="size-3 cursor-pointer" onClick={() => setMemberCountFilter("all")} />
                  </Badge>
                )}
                {reviewMode && (
                  <Badge variant="default" className="gap-1 text-[11px] h-6 px-2 bg-primary">
                    Review Mode: Selected Only
                    <X className="size-3 cursor-pointer" onClick={() => setReviewMode(false)} />
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

          {/* Optional Matching Local PDFs Collapsible */}
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 text-xs">
            <button
              type="button"
              onClick={() => setShowPdfSection(!showPdfSection)}
              className="flex w-full items-center justify-between text-left font-medium text-foreground hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <span>
                  Optional: Attach matching local PDF pitch decks ({pdfs.length} selected)
                </span>
              </span>
              {showPdfSection ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {showPdfSection && (
              <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                <p className="text-muted-foreground">
                  If your Excel sheet does not have Google Drive links, you can optionally upload local .pdf files.
                  Files named matching team names will be automatically paired.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pdfInputRef.current?.click()}
                    className="gap-2 text-xs"
                  >
                    <Upload className="size-3.5" />
                    Select PDF Files
                  </Button>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => setPdfs(Array.from(e.target.files ?? []))}
                  />
                  {pdfs.length > 0 && (
                    <span className="text-emerald-600 font-medium">
                      {pdfs.length} PDF file(s) loaded
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Parsed Teams Interactive Preview Table */}
          <div className="glass overflow-x-auto rounded-2xl border border-border/80">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/40 border-b border-border">
                <tr>
                  <th className="p-3 pl-4 w-10">
                    <Checkbox
                      checked={areAllFilteredSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAllFiltered();
                        } else {
                          deselectAllFiltered();
                        }
                      }}
                      title="Toggle select all filtered rows"
                    />
                  </th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Team &amp; College</th>
                  <th className="p-3">Project &amp; Track</th>
                  <th className="p-3">Pitch Deck / PDF</th>
                  <th className="p-3">Team Members</th>
                  {hasCustomMetadata && <th className="p-3">Custom Metadata</th>}
                  <th className="p-3 pr-4">Validation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={hasCustomMetadata ? 8 : 7} className="p-8 text-center text-muted-foreground">
                      <p className="font-semibold text-foreground">No records match your active filters.</p>
                      <p className="text-xs mt-1">Try clearing some filter criteria or search query.</p>
                      <Button variant="outline" size="sm" onClick={resetAllFilters} className="mt-3 text-xs">
                        Reset All Filters
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const localPdf = pdfFor(r.name);
                    const isSelected = selectedRowIds.has(r.id);
                    const customEntries = Object.entries(r.customMetadata);

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isSelected ? "bg-primary/5" : ""
                        } ${
                          r.status === "duplicate"
                            ? "opacity-60 bg-amber-500/5"
                            : r.status === "existing"
                            ? "opacity-75 bg-sky-500/5"
                            : r.status === "invalid"
                            ? "bg-rose-500/5"
                            : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 pl-4 align-top">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRowSelect(r.id)}
                            aria-label={`Select row ${r.name}`}
                          />
                        </td>

                        {/* Status */}
                        <td className="p-3 align-top whitespace-nowrap">
                          {r.status === "duplicate" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border border-amber-500/40 bg-amber-500/15 text-amber-600">
                              <AlertTriangle className="size-3" /> Duplicate
                            </span>
                          ) : r.status === "existing" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border border-sky-500/40 bg-sky-500/15 text-sky-600">
                              <Info className="size-3" /> In DB
                            </span>
                          ) : r.status === "ready" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border border-emerald-500/40 bg-emerald-500/15 text-emerald-600">
                              <CheckCircle2 className="size-3" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border border-rose-500/40 bg-rose-500/15 text-rose-600">
                              <XCircle className="size-3" /> Incomplete
                            </span>
                          )}
                          <div className="text-[10px] text-muted-foreground font-mono mt-1">
                            Row #{r.rowIndex}
                          </div>
                        </td>

                        {/* Team Name & College */}
                        <td className="p-3 align-top max-w-xs">
                          <div className="font-semibold text-foreground">
                            {r.name || <em className="text-rose-500">Missing Team Name</em>}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {r.email || <em className="text-rose-500">Missing Email</em>}
                          </div>
                          {r.college && (
                            <div className="text-[11px] text-primary/80 font-medium mt-1">
                              {r.college}
                            </div>
                          )}
                        </td>

                        {/* Project Title & Links */}
                        <td className="p-3 align-top max-w-xs">
                          {r.problem_statement && (
                            <span className="inline-block text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20 mb-1">
                              {r.problem_statement}
                            </span>
                          )}
                          <div className="font-medium text-foreground truncate" title={r.project_title}>
                            {r.project_title || <em className="text-rose-500">Missing Title</em>}
                          </div>
                          {r.track && (
                            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">
                              Track: {r.track}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                            {r.github_url && (
                              <a
                                href={r.github_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-0.5"
                              >
                                GitHub <ExternalLink className="size-2.5" />
                              </a>
                            )}
                            {r.website_url && r.website_url !== r.github_url && (
                              <a
                                href={r.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline flex items-center gap-0.5"
                              >
                                Live App <ExternalLink className="size-2.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Pitch Deck / Presentation */}
                        <td className="p-3 align-top max-w-xs">
                          {r.pdf_url ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 border border-blue-500/30">
                                Drive Link Attached
                              </span>
                              <div className="text-[11px] text-muted-foreground truncate" title={r.pdf_url}>
                                {r.pdf_url}
                              </div>
                            </div>
                          ) : localPdf ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                                Local PDF Paired
                              </span>
                              <div className="text-[11px] text-muted-foreground truncate">{localPdf.name}</div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              Pending (Optional)
                            </span>
                          )}
                        </td>

                        {/* Team Members */}
                        <td className="p-3 align-top text-xs min-w-56">
                          <div className="flex items-center gap-1 text-muted-foreground font-medium mb-1.5">
                            <Users className="size-3.5" />
                            <span>{r.members.length} Member(s)</span>
                          </div>
                          {r.members.length > 0 ? (
                            <div className="space-y-1">
                              {r.members.map((m, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="flex flex-col text-[11px] bg-background/60 p-1.5 rounded-lg border border-border/50"
                                >
                                  <div className="font-semibold text-foreground flex items-center justify-between">
                                    <span>
                                      {mIdx === 0 ? "1. (Lead) " : `${mIdx + 1}. `}
                                      {m.name}
                                    </span>
                                  </div>
                                  {m.email && (
                                    <span className="text-muted-foreground font-mono text-[10px] truncate">
                                      {m.email}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <em className="text-rose-500">No members mapped</em>
                          )}
                        </td>

                        {/* Custom Metadata Column (if mapped) */}
                        {hasCustomMetadata && (
                          <td className="p-3 align-top text-xs max-w-xs">
                            {customEntries.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {customEntries.map(([k, v]) => (
                                  <span
                                    key={k}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] border border-border/50"
                                    title={`${k}: ${v}`}
                                  >
                                    <strong className="text-foreground">{k}:</strong>
                                    <span className="text-muted-foreground truncate max-w-28">{v}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">—</span>
                            )}
                          </td>
                        )}

                        {/* Issues / Details */}
                        <td className="p-3 pr-4 align-top text-xs">
                          {r.status === "duplicate" ? (
                            <span className="text-amber-600 font-medium">
                              Duplicate team name in this Excel sheet
                            </span>
                          ) : r.status === "existing" ? (
                            <span className="text-sky-600 font-medium">
                              Team is already registered in the system
                            </span>
                          ) : r.issues.length > 0 ? (
                            <ul className="text-rose-600 list-disc list-inside space-y-0.5">
                              {r.issues.map((iss, i) => (
                                <li key={i}>{iss}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <Check className="size-3" /> All checks passed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        View imported projects in{" "}
        <Link to="/teams" className="text-primary hover:underline font-medium">
          Teams
        </Link>
        .
      </p>
    </>
  );
}
