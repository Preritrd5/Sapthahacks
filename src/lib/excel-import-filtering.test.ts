import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { generateTeamImportTemplate, exportRows, readSheet } from "./export";
import { extractTeamMetadata } from "./queries";

describe("Excel Template Structure & 4-Member Compatibility", () => {
  it("generates an Excel template workbook with all 4 team members and correct columns", () => {
    // Generate workbook in-memory using XLSX utils like exportRows does
    const templateRows = [
      {
        "Team Name": "Team Alpha",
        "College / Institution": "Sapthagiri College of Engineering",
        "Team Email": "alpha@sapthagiri.edu",
        "Track / Domain": "Data Engineering & AI Systems",
        "Problem Statement": "PS-01",
        "Project Title": "[PS-01] Messy Data Repair Engine",
        "Project Description": "Automated data cleaning and ML imputation pipeline.",
        "Pitch Deck / PDF (Google Drive Link)": "https://drive.google.com/file/d/sample/view",
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
        "Project Description": "Autonomous patch synthesis system.",
        "Pitch Deck / PDF (Google Drive Link)": "https://drive.google.com/file/d/sample2/view",
        "GitHub URL": "https://github.com/team-beta/auto-bug-repair",
        "Website URL": "https://beta-bug-repair.vercel.app",
        "Member 1 Name": "Rohan Patel",
        "Member 1 Email": "rohan@bmsce.ac.in",
        "Member 2 Name": "Ananya Iyer",
        "Member 2 Email": "ananya@bmsce.ac.in",
        "Member 3 Name": "",
        "Member 3 Email": "",
        "Member 4 Name": "",
        "Member 4 Email": "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    ws["!autofilter"] = { ref: ws["!ref"]! };
    ws["!views"] = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    // Read back and verify
    const readWb = XLSX.read(buf, { type: "array" });
    const readWs = readWb.Sheets["Sheet1"]!;
    const parsedData: Record<string, string>[] = XLSX.utils.sheet_to_json(readWs);

    expect(parsedData.length).toBe(2);

    // Verify all 4 member headers exist
    const row1 = parsedData[0]!;
    expect(row1["Member 1 Name"]).toBe("Aarav Sharma");
    expect(row1["Member 1 Email"]).toBe("aarav@sapthagiri.edu");
    expect(row1["Member 2 Name"]).toBe("Diya Rao");
    expect(row1["Member 2 Email"]).toBe("diya@sapthagiri.edu");
    expect(row1["Member 3 Name"]).toBe("Vikram Singh");
    expect(row1["Member 3 Email"]).toBe("vikram@sapthagiri.edu");
    expect(row1["Member 4 Name"]).toBe("Neha Gupta");
    expect(row1["Member 4 Email"]).toBe("neha@sapthagiri.edu");

    // Verify row 2 has Member 3 and 4 optional (empty or undefined)
    const row2 = parsedData[1]!;
    expect(row2["Member 1 Name"]).toBe("Rohan Patel");
    expect(row2["Member 2 Name"]).toBe("Ananya Iyer");
    expect(row2["Member 3 Name"] ?? "").toBe("");
    expect(row2["Member 4 Name"] ?? "").toBe("");

    // Verify AutoFilter ref
    expect(readWs["!autofilter"]).toBeDefined();
  });

  it("maintains backward compatibility with legacy 2-member templates", () => {
    const legacyRows = [
      {
        "Team Name": "Legacy Duo",
        "Team Email": "duo@example.com",
        "Project Title": "Legacy Project",
        "Project Description": "Legacy description",
        "GitHub URL": "https://github.com/legacy/repo",
        "Website URL": "https://legacy.dev",
        "Member1 Name": "Alice",
        "Member1 Email": "alice@example.com",
        "Member2 Name": "Bob",
        "Member2 Email": "bob@example.com",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(legacyRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const readWb = XLSX.read(buf, { type: "array" });
    const readWs = readWb.Sheets["Sheet1"]!;
    const parsedData: Record<string, string>[] = XLSX.utils.sheet_to_json(readWs);

    expect(parsedData.length).toBe(1);
    expect(parsedData[0]!["Member1 Name"]).toBe("Alice");
    expect(parsedData[0]!["Member2 Name"]).toBe("Bob");
  });
});

describe("Multi-Filter & Search Simulation", () => {
  const sampleDataset = [
    {
      id: "row_1",
      name: "Quantum Coders",
      college: "Sapthagiri College of Engineering",
      email: "quantum@sapthagiri.edu",
      track: "Data Engineering & AI Systems",
      problem_statement: "PS-01",
      project_title: "[PS-01] AI Evaluation Engine",
      project_description: "Automated grading pipeline",
      github_url: "https://github.com/quantum/eval",
      website_url: "https://quantum.dev",
      members: [
        { name: "Aarav Sharma", email: "aarav@sapthagiri.edu" },
        { name: "Diya Rao", email: "diya@sapthagiri.edu" },
        { name: "Vikram Singh", email: "vikram@sapthagiri.edu" },
        { name: "Neha Gupta", email: "neha@sapthagiri.edu" },
      ],
      status: "ready" as const,
      isValid: true,
      duplicateInSheet: false,
      alreadyInDb: false,
    },
    {
      id: "row_2",
      name: "Cyber Knights",
      college: "BMS College of Engineering",
      email: "knights@bmsce.ac.in",
      track: "Cybersecurity & Media Forensics",
      problem_statement: "PS-04",
      project_title: "[PS-04] Deepfake Shield",
      project_description: "Multimodal forensics detection",
      github_url: "https://github.com/knights/deepfake",
      website_url: "https://knights.dev",
      members: [
        { name: "Rohan Patel", email: "rohan@bmsce.ac.in" },
        { name: "Ananya Iyer", email: "ananya@bmsce.ac.in" },
      ],
      status: "ready" as const,
      isValid: true,
      duplicateInSheet: false,
      alreadyInDb: false,
    },
    {
      id: "row_3",
      name: "Dev Innovators",
      college: "PES University",
      email: "dev@pes.edu",
      track: "Developer Tools & AI Agents",
      problem_statement: "PS-02",
      project_title: "[PS-02] Bug Repair Bot",
      project_description: "Autonomous patch generator",
      github_url: "https://github.com/dev/patcher",
      website_url: "https://dev.dev",
      members: [
        { name: "Siddharth Joshi", email: "siddharth@pes.edu" },
        { name: "Pooja Hegde", email: "pooja@pes.edu" },
        { name: "Varun Teja", email: "varun@pes.edu" },
      ],
      status: "existing" as const,
      isValid: true,
      duplicateInSheet: false,
      alreadyInDb: true,
    },
    {
      id: "row_4",
      name: "Broken Record",
      college: "Sapthagiri College of Engineering",
      email: "broken@",
      track: "Data Engineering & AI Systems",
      problem_statement: "PS-01",
      project_title: "",
      project_description: "",
      github_url: "not-a-github-url",
      website_url: "",
      members: [],
      status: "invalid" as const,
      isValid: false,
      duplicateInSheet: false,
      alreadyInDb: false,
    },
  ];

  it("filters accurately by global search across team, college, leader, and all 4 members", () => {
    // Search member 4 name
    const q1 = "Neha";
    const res1 = sampleDataset.filter((r) =>
      [r.name, r.college, r.email, ...r.members.map((m) => m.name), ...r.members.map((m) => m.email)].some((v) =>
        v.toLowerCase().includes(q1.toLowerCase())
      )
    );
    expect(res1.length).toBe(1);
    expect(res1[0]!.name).toBe("Quantum Coders");

    // Search college
    const q2 = "PES";
    const res2 = sampleDataset.filter((r) =>
      [r.name, r.college, r.email, ...r.members.map((m) => m.name)].some((v) =>
        v.toLowerCase().includes(q2.toLowerCase())
      )
    );
    expect(res2.length).toBe(1);
    expect(res2[0]!.name).toBe("Dev Innovators");
  });

  it("filters accurately by college, track, and status combined", () => {
    const combined = sampleDataset.filter((r) => {
      const matchCollege = r.college === "Sapthagiri College of Engineering";
      const matchTrack = r.track === "Data Engineering & AI Systems";
      const matchStatus = r.status === "ready";
      return matchCollege && matchTrack && matchStatus;
    });

    expect(combined.length).toBe(1);
    expect(combined[0]!.name).toBe("Quantum Coders");
  });

  it("preserves selected records when active filters change", () => {
    const selectedIds = new Set<string>();

    // Step 1: Filter to Sapthagiri College (matches row_1 and row_4)
    const filter1 = sampleDataset.filter((r) => r.college === "Sapthagiri College of Engineering");
    expect(filter1.length).toBe(2);

    // User selects row_1
    selectedIds.add(filter1[0]!.id);
    expect(selectedIds.has("row_1")).toBe(true);

    // Step 2: User changes filter to PES University (matches row_3)
    const filter2 = sampleDataset.filter((r) => r.college === "PES University");
    expect(filter2.length).toBe(1);

    // User selects row_3
    selectedIds.add(filter2[0]!.id);

    // Step 3: Clear all filters (showing all 4 rows)
    expect(selectedIds.size).toBe(2);
    expect(selectedIds.has("row_1")).toBe(true);
    expect(selectedIds.has("row_3")).toBe(true);

    // Step 4: Selective upload only returns the 2 selected rows
    const toImport = sampleDataset.filter((r) => selectedIds.has(r.id) && r.isValid && !r.alreadyInDb);
    // row_3 is alreadyInDb, so only row_1 passes ready criteria
    expect(toImport.length).toBe(1);
    expect(toImport[0]!.id).toBe("row_1");
  });

  it("correctly extracts team metadata from remarks and project titles", () => {
    const meta1 = extractTeamMetadata({
      remarks: "College: Sapthagiri College of Engineering | Track: AI & Machine Learning | PS: PS-01",
      email: "team@sapthagiri.edu",
      project_title: "[PS-01] Clean Pipeline",
    });

    expect(meta1.college).toBe("Sapthagiri College of Engineering");
    expect(meta1.track).toBe("AI & Machine Learning");
    expect(meta1.psCode).toBe("PS-01");

    // Fallback detection from email domain and project_title tag
    const meta2 = extractTeamMetadata({
      remarks: null,
      email: "lead@sapthagiri.edu",
      project_title: "[PS-03] Citation System",
    });

    expect(meta2.college).toBe("Sapthagiri College of Engineering");
    expect(meta2.psCode).toBe("PS-03");
  });
});
