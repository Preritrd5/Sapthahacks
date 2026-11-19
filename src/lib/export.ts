import * as XLSX from "xlsx";

export interface ExportOptions {
  autoFilter?: boolean | undefined;
  freezeHeader?: boolean | undefined;
  colWidths?: Record<string, number> | undefined;
}

export function downloadBlob(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRows(
  rows: Record<string, unknown>[],
  name: string,
  kind: "csv" | "xlsx",
  options?: ExportOptions | undefined
) {
  const ws = XLSX.utils.json_to_sheet(rows);

  if (rows.length > 0) {
    const keys = Object.keys(rows[0]!);

    // Calculate intelligent column widths
    ws["!cols"] = keys.map((key) => {
      let maxLen = key.length;
      for (const row of rows) {
        const val = row[key];
        const strVal = val != null ? String(val) : "";
        if (strVal.length > maxLen) {
          maxLen = Math.min(strVal.length, 75);
        }
      }
      const customWidth = options?.colWidths?.[key];
      return { wch: customWidth ?? Math.max(maxLen + 5, 18) };
    });

    // Add AutoFilter dropdowns to column headers
    if (options?.autoFilter !== false && ws["!ref"]) {
      ws["!autofilter"] = { ref: ws["!ref"] };
    }

    // Freeze the header row so column names remain visible during vertical scrolling
    if (options?.freezeHeader !== false) {
      ws["!views"] = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
    }
  }

  if (kind === "csv") return downloadBlob(XLSX.utils.sheet_to_csv(ws), `${name}.csv`, "text/csv");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  downloadBlob(XLSX.write(wb, { type: "array", bookType: "xlsx" }), `${name}.xlsx`, "application/octet-stream");
}

export async function readSheet(file: File): Promise<Record<string, string>[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
}

/**
 * Standard Hackathon Team Bulk Import Template
 * Supports all 4 team members (Member 3 & 4 optional) with frozen header row and AutoFilter dropdowns.
 */
export function generateTeamImportTemplate() {
  const templateRows = [
    {
      "Team Name": "Team Alpha",
      "College / Institution": "Sapthagiri College of Engineering",
      "Team Email": "alpha@sapthagiri.edu",
      "Track / Domain": "Data Engineering & AI Systems",
      "Problem Statement": "PS-01",
      "Project Title": "[PS-01] Messy Data Repair Engine",
      "Project Description":
        "Automated data cleaning, schema reconciliation, and ML-driven missing value imputation pipeline for heterogeneous datasets.",
      "Pitch Deck / PDF (Google Drive Link)":
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up00/view",
      "GitHub URL": "https://github.com/team-alpha/messy-data-repair",
      "Website URL": "https://alpha-repair-engine.vercel.app",
      "Member 1 Name": "Aarav Sharma",
      "Member 1 Email": "aarav@sapthagiri.edu",
      "Member 2 Name": "Diya Rao",
      "Member 2 Email": "diya@sapthagiri.edu",
      "Member 3 Name": "Vikram Singh",
      "Member 3 Email": "vikram@sapthagiri.edu",
      "Member 4 Name": "Neha Gupta",
      "Member 4 Email": "neha@sapthagiri.edu",
    },
    {
      "Team Name": "Team Beta",
      "College / Institution": "BMS College of Engineering",
      "Team Email": "beta@bmsce.ac.in",
      "Track / Domain": "Developer Tools & AI Agents",
      "Problem Statement": "PS-02",
      "Project Title": "[PS-02] Automatic Software Bug Repair System",
      "Project Description":
        "Autonomous program analysis and neural patch synthesis system for failing test suites with AST validation.",
      "Pitch Deck / PDF (Google Drive Link)":
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up01/view",
      "GitHub URL": "https://github.com/team-beta/auto-bug-repair",
      "Website URL": "https://beta-bug-repair.vercel.app",
      "Member 1 Name": "Rohan Patel",
      "Member 1 Email": "rohan@bmsce.ac.in",
      "Member 2 Name": "Ananya Iyer",
      "Member 2 Email": "ananya@bmsce.ac.in",
      "Member 3 Name": "Kiran Verma",
      "Member 3 Email": "kiran@bmsce.ac.in",
      "Member 4 Name": "",
      "Member 4 Email": "",
    },
    {
      "Team Name": "Team Gamma",
      "College / Institution": "PES University",
      "Team Email": "gamma@pes.edu",
      "Track / Domain": "Academic Integrity & NLP",
      "Problem Statement": "PS-03",
      "Project Title": "[PS-03] Research Claim and Citation Checker",
      "Project Description":
        "Evidence-grounded research validation tool that inspects scientific papers and cross-references assertions against published corpora.",
      "Pitch Deck / PDF (Google Drive Link)":
        "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OIvE2up02/view",
      "GitHub URL": "https://github.com/team-gamma/citation-checker",
      "Website URL": "https://gamma-citation.vercel.app",
      "Member 1 Name": "Meera Nair",
      "Member 1 Email": "meera@pes.edu",
      "Member 2 Name": "Siddharth Joshi",
      "Member 2 Email": "siddharth@pes.edu",
      "Member 3 Name": "",
      "Member 3 Email": "",
      "Member 4 Name": "",
      "Member 4 Email": "",
    },
  ];

  exportRows(templateRows, "innovedge-team-import-template", "xlsx", {
    autoFilter: true,
    freezeHeader: true,
    colWidths: {
      "Team Name": 22,
      "College / Institution": 32,
      "Team Email": 26,
      "Track / Domain": 28,
      "Problem Statement": 18,
      "Project Title": 36,
      "Project Description": 50,
      "Pitch Deck / PDF (Google Drive Link)": 44,
      "GitHub URL": 36,
      "Website URL": 32,
      "Member 1 Name": 20,
      "Member 1 Email": 25,
      "Member 2 Name": 20,
      "Member 2 Email": 25,
      "Member 3 Name": 20,
      "Member 3 Email": 25,
      "Member 4 Name": 20,
      "Member 4 Email": 25,
    },
  });
}

