import { describe, expect, it } from "vitest";
import {
  detectFieldForHeader,
  createDefaultColumnMapping,
  validateColumnMapping,
  parseRowsWithMapping,
  normalizeHeaderKey,
  isUnambiguousMapping,
  REQUIRED_PORTAL_FIELDS,
  type ColumnMappingState,
} from "./column-mapping";

describe("Dynamic Column Mapping & Selection Engine", () => {
  it("normalizes headers accurately by removing non-alphanumeric chars and lowercasing", () => {
    expect(normalizeHeaderKey("Team Name")).toBe("teamname");
    expect(normalizeHeaderKey("College / Institution")).toBe("collegeinstitution");
    expect(normalizeHeaderKey("Pitch Deck / PDF (Google Drive Link)")).toBe("pitchdeckpdfgoogledrivelink");
    expect(normalizeHeaderKey("Member 1 - Name")).toBe("member1name");
  });

  it("auto-detects standard hackathon template headers", () => {
    expect(detectFieldForHeader("Team Name")).toBe("name");
    expect(detectFieldForHeader("Project Title")).toBe("project_title");
    expect(detectFieldForHeader("Project Description")).toBe("project_description");
    expect(detectFieldForHeader("Team Email")).toBe("email");
    expect(detectFieldForHeader("College / Institution")).toBe("college");
    expect(detectFieldForHeader("Track / Domain")).toBe("track");
    expect(detectFieldForHeader("Problem Statement")).toBe("problem_statement");
    expect(detectFieldForHeader("GitHub URL")).toBe("github_url");
    expect(detectFieldForHeader("Website URL")).toBe("website_url");
    expect(detectFieldForHeader("Pitch Deck / PDF (Google Drive Link)")).toBe("pdf_url");

    // All 4 team members
    expect(detectFieldForHeader("Member 1 Name")).toBe("member_1_name");
    expect(detectFieldForHeader("Member 1 Email")).toBe("member_1_email");
    expect(detectFieldForHeader("Member 2 Name")).toBe("member_2_name");
    expect(detectFieldForHeader("Member 2 Email")).toBe("member_2_email");
    expect(detectFieldForHeader("Member 3 Name")).toBe("member_3_name");
    expect(detectFieldForHeader("Member 3 Email")).toBe("member_3_email");
    expect(detectFieldForHeader("Member 4 Name")).toBe("member_4_name");
    expect(detectFieldForHeader("Member 4 Email")).toBe("member_4_email");
  });

  it("handles header variations and legacy naming conventions", () => {
    expect(detectFieldForHeader("Leader Name")).toBe("member_1_name");
    expect(detectFieldForHeader("Lead Name")).toBe("member_1_name");
    expect(detectFieldForHeader("Repository")).toBe("github_url");
    expect(detectFieldForHeader("Repo")).toBe("github_url");
    expect(detectFieldForHeader("Demo URL")).toBe("website_url");
    expect(detectFieldForHeader("Drive Link")).toBe("pdf_url");
    expect(detectFieldForHeader("PS Code")).toBe("problem_statement");
  });

  it("ignores timestamp and ID columns by default, and treats unknown columns as custom metadata", () => {
    expect(detectFieldForHeader("Timestamp")).toBe("ignore");
    expect(detectFieldForHeader("S.No")).toBe("ignore");
    expect(detectFieldForHeader("Serial Number")).toBe("ignore");
    expect(detectFieldForHeader("ID")).toBe("ignore");

    // Unrecognized custom fields
    expect(detectFieldForHeader("Lab Assigned")).toBe("custom_metadata");
    expect(detectFieldForHeader("T-Shirt Size")).toBe("custom_metadata");
    expect(detectFieldForHeader("Dietary Requirements")).toBe("custom_metadata");
  });

  it("creates a default column mapping state and activates mapped columns", () => {
    const headers = [
      "Team Name",
      "Team Email",
      "Project Title",
      "Project Description",
      "GitHub URL",
      "Member 1 Name",
      "Member 2 Name",
      "Timestamp",
      "Custom Department Name",
    ];

    const mapping = createDefaultColumnMapping(headers);

    expect(mapping["Team Name"]?.targetField).toBe("name");
    expect(mapping["Team Name"]?.selected).toBe(true);

    expect(mapping["Timestamp"]?.targetField).toBe("ignore");
    expect(mapping["Timestamp"]?.selected).toBe(false);

    expect(mapping["Custom Department Name"]?.targetField).toBe("custom_metadata");
    expect(mapping["Custom Department Name"]?.selected).toBe(true);
  });

  it("validates required portal fields and identifies missing mandatory mappings", () => {
    // Incomplete mapping missing Member 2 Name and GitHub URL
    const incompleteMapping: ColumnMappingState = {
      "Team Name": { targetField: "name", selected: true },
      "Team Email": { targetField: "email", selected: true },
      "Project Title": { targetField: "project_title", selected: true },
      "Project Description": { targetField: "project_description", selected: true },
      "Member 1 Name": { targetField: "member_1_name", selected: true },
    };

    const incompleteVal = validateColumnMapping(incompleteMapping);
    expect(incompleteVal.isValid).toBe(false);
    expect(incompleteVal.missingRequiredFields.map((f) => f.id)).toContain("member_2_name");
    expect(incompleteVal.missingRequiredFields.map((f) => f.id)).toContain("github_url");

    // Complete mapping satisfying all required portal fields
    const completeMapping: ColumnMappingState = {
      ...incompleteMapping,
      "Member 2 Name": { targetField: "member_2_name", selected: true },
      "GitHub Repo": { targetField: "github_url", selected: true },
    };

    const completeVal = validateColumnMapping(completeMapping);
    expect(completeVal.isValid).toBe(true);
    expect(completeVal.missingRequiredFields.length).toBe(0);
  });

  it("deselected columns are treated as unmapped even if targetField is assigned", () => {
    const mapping: ColumnMappingState = {
      "Team Name": { targetField: "name", selected: false }, // Deselected!
      "Team Email": { targetField: "email", selected: true },
      "Project Title": { targetField: "project_title", selected: true },
      "Project Description": { targetField: "project_description", selected: true },
      "Member 1 Name": { targetField: "member_1_name", selected: true },
      "Member 2 Name": { targetField: "member_2_name", selected: true },
      "GitHub Repo": { targetField: "github_url", selected: true },
    };

    const val = validateColumnMapping(mapping);
    expect(val.isValid).toBe(false);
    expect(val.missingRequiredFields.map((f) => f.id)).toContain("name");
  });

  it("parses spreadsheet rows strictly according to active column mapping and captures custom metadata", () => {
    const rawData = [
      {
        "Group Name": "AI Pioneers",
        "Leader Mail": "leader@aipioneers.io",
        "Submission Title": "Neural Code Healer",
        "Submission Summary": "Autonomous neural compiler and self-repairing AST engine.",
        "Code Repo": "https://github.com/ai-pioneers/code-healer",
        "Deployed Demo": "https://code-healer.app",
        "Lead Dev": "Dev Leader",
        "Lead Dev Email": "leader@aipioneers.io",
        "Second Dev": "Dev Second",
        "Second Dev Email": "second@aipioneers.io",
        "Third Dev": "Dev Third",
        "Third Dev Email": "third@aipioneers.io",
        "Sponsor Lab": "AI-Research-Lab-4",
        "Ignored Timestamp": "2026-11-20 03:00:00",
      },
    ];

    const mapping: ColumnMappingState = {
      "Group Name": { targetField: "name", selected: true },
      "Leader Mail": { targetField: "email", selected: true },
      "Submission Title": { targetField: "project_title", selected: true },
      "Submission Summary": { targetField: "project_description", selected: true },
      "Code Repo": { targetField: "github_url", selected: true },
      "Deployed Demo": { targetField: "website_url", selected: true },
      "Lead Dev": { targetField: "member_1_name", selected: true },
      "Lead Dev Email": { targetField: "member_1_email", selected: true },
      "Second Dev": { targetField: "member_2_name", selected: true },
      "Second Dev Email": { targetField: "member_2_email", selected: true },
      "Third Dev": { targetField: "member_3_name", selected: true },
      "Third Dev Email": { targetField: "member_3_email", selected: true },
      "Sponsor Lab": { targetField: "custom_metadata", selected: true },
      "Ignored Timestamp": { targetField: "ignore", selected: false },
    };

    const parsed = parseRowsWithMapping(rawData, mapping, []);
    expect(parsed.length).toBe(1);

    const team = parsed[0]!;
    expect(team.name).toBe("AI Pioneers");
    expect(team.email).toBe("leader@aipioneers.io");
    expect(team.project_title).toBe("Neural Code Healer");
    expect(team.github_url).toBe("https://github.com/ai-pioneers/code-healer");
    expect(team.website_url).toBe("https://code-healer.app");

    // 3 members extracted
    expect(team.members.length).toBe(3);
    expect(team.members[0]!.name).toBe("Dev Leader");
    expect(team.members[1]!.name).toBe("Dev Second");
    expect(team.members[2]!.name).toBe("Dev Third");

    // Custom metadata captured
    expect(team.customMetadata["Sponsor Lab"]).toBe("AI-Research-Lab-4");
    expect(team.customMetadata["Ignored Timestamp"]).toBeUndefined();

    // Validity
    expect(team.isValid).toBe(true);
    expect(team.status).toBe("ready");
  });

  it("determines unambiguous mappings accurately", () => {
    // Recognized portal fields return true
    expect(isUnambiguousMapping("Team Name", "name")).toBe(true);
    expect(isUnambiguousMapping("Project Title", "project_title")).toBe(true);
    expect(isUnambiguousMapping("Member 3 Name", "member_3_name")).toBe(true);
    expect(isUnambiguousMapping("Member 4 Email", "member_4_email")).toBe(true);
    expect(isUnambiguousMapping("GitHub URL", "github_url")).toBe(true);

    // Ignored columns and custom metadata return false so manual controls are shown
    expect(isUnambiguousMapping("Timestamp", "ignore")).toBe(false);
    expect(isUnambiguousMapping("Custom Department", "custom_metadata")).toBe(false);
  });

  it("detects and flags duplicate target field conflicts", () => {
    const conflictMapping: ColumnMappingState = {
      "Team Name": { targetField: "name", selected: true },
      "Group Name": { targetField: "name", selected: true }, // DUPLICATE TARGET
      "Team Email": { targetField: "email", selected: true },
      "Project Title": { targetField: "project_title", selected: true },
      "Project Description": { targetField: "project_description", selected: true },
      "Member 1 Name": { targetField: "member_1_name", selected: true },
      "Member 2 Name": { targetField: "member_2_name", selected: true },
      "GitHub Repo": { targetField: "github_url", selected: true },
    };

    const val = validateColumnMapping(conflictMapping);
    expect(val.isValid).toBe(false);
    expect(val.duplicateFieldMappings.length).toBe(1);
    expect(val.duplicateFieldMappings[0]?.targetField).toBe("name");
    expect(val.duplicateFieldMappings[0]?.headers).toEqual(["Team Name", "Group Name"]);
  });

  it("supports four team members end-to-end with validation", () => {
    const raw4Member = [
      {
        "Team Name": "Quantum Builders",
        "Team Email": "quantum@example.com",
        "Project Title": "Quantum Cryptography Suite",
        "Project Description": "Post-quantum cryptographic key exchange and lattice analysis.",
        "GitHub URL": "https://github.com/quantum/suite",
        "Website URL": "https://quantum-suite.dev",
        "Member 1 Name": "Alice Smith",
        "Member 1 Email": "alice@example.com",
        "Member 2 Name": "Bob Jones",
        "Member 2 Email": "bob@example.com",
        "Member 3 Name": "Charlie Brown",
        "Member 3 Email": "charlie@example.com",
        "Member 4 Name": "Dana Scully",
        "Member 4 Email": "dana@example.com",
      },
    ];

    const defaultMapping = createDefaultColumnMapping(Object.keys(raw4Member[0]!));
    const parsed = parseRowsWithMapping(raw4Member, defaultMapping, []);

    expect(parsed.length).toBe(1);
    const team = parsed[0]!;
    expect(team.isValid).toBe(true);
    expect(team.status).toBe("ready");
    expect(team.members.length).toBe(4);
    expect(team.members[0]).toEqual({ name: "Alice Smith", email: "alice@example.com" });
    expect(team.members[1]).toEqual({ name: "Bob Jones", email: "bob@example.com" });
    expect(team.members[2]).toEqual({ name: "Charlie Brown", email: "charlie@example.com" });
    expect(team.members[3]).toEqual({ name: "Dana Scully", email: "dana@example.com" });
  });

  it("handles optional Member 3 and Member 4 fields when left empty", () => {
    const raw2Member = [
      {
        "Team Name": "Duo Coders",
        "Team Email": "duo@example.com",
        "Project Title": "Duo Platform",
        "Project Description": "Lightweight two-person collaborative editor.",
        "GitHub URL": "https://github.com/duo/editor",
        "Member 1 Name": "Dev One",
        "Member 1 Email": "one@example.com",
        "Member 2 Name": "Dev Two",
        "Member 2 Email": "two@example.com",
        "Member 3 Name": "",
        "Member 3 Email": "",
        "Member 4 Name": "",
        "Member 4 Email": "",
      },
    ];

    const defaultMapping = createDefaultColumnMapping(Object.keys(raw2Member[0]!));
    const parsed = parseRowsWithMapping(raw2Member, defaultMapping, []);

    expect(parsed.length).toBe(1);
    const team = parsed[0]!;
    expect(team.isValid).toBe(true);
    expect(team.status).toBe("ready");
    expect(team.members.length).toBe(2);
    expect(team.issues.length).toBe(0);
  });

  it("flags incomplete member information when email is given without name", () => {
    const incompleteMemberRow = [
      {
        "Team Name": "Glitch Team",
        "Team Email": "glitch@example.com",
        "Project Title": "Bug Tracker",
        "Project Description": "Automated regression tracker.",
        "GitHub URL": "https://github.com/glitch/tracker",
        "Member 1 Name": "Lead Person",
        "Member 1 Email": "lead@example.com",
        "Member 2 Name": "Second Person",
        "Member 2 Email": "second@example.com",
        "Member 3 Name": "", // EMPTY NAME
        "Member 3 Email": "ghost-member3@example.com", // BUT EMAIL PROVIDED
      },
    ];

    const mapping = createDefaultColumnMapping(Object.keys(incompleteMemberRow[0]!));
    const parsed = parseRowsWithMapping(incompleteMemberRow, mapping, []);

    expect(parsed.length).toBe(1);
    const team = parsed[0]!;
    expect(team.isValid).toBe(false);
    expect(team.status).toBe("invalid");
    expect(team.issues.some((issue) => issue.includes("Member 3 name is missing"))).toBe(true);
  });

  it("flags duplicate member emails within the same team", () => {
    const duplicateEmailRow = [
      {
        "Team Name": "Duplicate Squad",
        "Team Email": "squad@example.com",
        "Project Title": "Identity Verifier",
        "Project Description": "Identity and access management.",
        "GitHub URL": "https://github.com/squad/iam",
        "Member 1 Name": "Person One",
        "Member 1 Email": "shared@example.com",
        "Member 2 Name": "Person Two",
        "Member 2 Email": "shared@example.com", // DUPLICATE EMAIL
      },
    ];

    const mapping = createDefaultColumnMapping(Object.keys(duplicateEmailRow[0]!));
    const parsed = parseRowsWithMapping(duplicateEmailRow, mapping, []);

    expect(parsed.length).toBe(1);
    const team = parsed[0]!;
    expect(team.isValid).toBe(false);
    expect(team.status).toBe("invalid");
    expect(team.issues.some((issue) => issue.includes("Duplicate member email"))).toBe(true);
  });

  it("allows administrators to manually correct an auto-detected mapping", () => {
    const rawData = [
      {
        "Team Name": "Flexi Team",
        "Team Email": "flexi@example.com",
        "Project Title": "Flexi Portal",
        "Project Description": "Extensible portal system.",
        "GitHub URL": "https://github.com/flexi/portal",
        "Member 1 Name": "Solo Dev",
        "Member 2 Name": "Co Dev",
        "Department Link": "https://flexi.edu/dept",
      },
    ];

    const mapping = createDefaultColumnMapping(Object.keys(rawData[0]!));
    // Default auto-detects "Department Link" as custom_metadata
    expect(mapping["Department Link"]?.targetField).toBe("custom_metadata");

    // Administrator manually remaps "Department Link" to "website_url"
    mapping["Department Link"] = { targetField: "website_url", selected: true };

    const parsed = parseRowsWithMapping(rawData, mapping, []);
    expect(parsed.length).toBe(1);
    expect(parsed[0]?.website_url).toBe("https://flexi.edu/dept");
    expect(parsed[0]?.customMetadata["Department Link"]).toBeUndefined();
  });
});
