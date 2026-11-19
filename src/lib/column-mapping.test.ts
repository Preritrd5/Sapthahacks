import { describe, expect, it } from "vitest";
import {
  detectFieldForHeader,
  createDefaultColumnMapping,
  validateColumnMapping,
  parseRowsWithMapping,
  normalizeHeaderKey,
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
});
