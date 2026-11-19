/**
 * INNOVEDGE Assessor Platform — Dynamic Excel Column Mapping & Selection Engine
 * 
 * Provides type-safe definitions, automated header matching, required field enforcement,
 * duplicate collision detection, column mapping state management, and parsed row generation.
 */

export type PortalFieldId =
  | "name"
  | "project_title"
  | "project_description"
  | "email"
  | "college"
  | "track"
  | "problem_statement"
  | "github_url"
  | "website_url"
  | "pdf_url"
  | "member_1_name"
  | "member_1_email"
  | "member_2_name"
  | "member_2_email"
  | "member_3_name"
  | "member_3_email"
  | "member_4_name"
  | "member_4_email"
  | "custom_metadata"
  | "ignore";

export interface PortalFieldDef {
  id: PortalFieldId;
  label: string;
  category: "core" | "members" | "links" | "special";
  required: boolean;
  description: string;
  aliases: string[];
}

export const PORTAL_FIELDS: PortalFieldDef[] = [
  // 1. Core Fields
  {
    id: "name",
    label: "Team Name",
    category: "core",
    required: true,
    description: "Official competitive team identifier",
    aliases: ["teamname", "team", "name", "groupname", "teamtitle"],
  },
  {
    id: "project_title",
    label: "Project Title",
    category: "core",
    required: true,
    description: "Name of the hackathon solution or project",
    aliases: ["projecttitle", "title", "project", "projectname", "submissiontitle"],
  },
  {
    id: "project_description",
    label: "Project Description",
    category: "core",
    required: true,
    description: "Detailed summary, problem alignment & solution architecture",
    aliases: ["projectdescription", "description", "details", "problemdescription", "abstract", "summary"],
  },
  {
    id: "email",
    label: "Team / Contact Email",
    category: "core",
    required: true,
    description: "Primary contact email address for the team",
    aliases: ["teamemail", "email", "contactemail", "leaderemail", "leademail", "primaryemail"],
  },
  {
    id: "college",
    label: "College / Institution",
    category: "core",
    required: false,
    description: "Academic institution or organization name",
    aliases: ["collegeinstitution", "college", "institution", "university", "institute", "school", "campus"],
  },
  {
    id: "track",
    label: "Track / Domain",
    category: "core",
    required: false,
    description: "Hackathon challenge category or theme",
    aliases: ["trackdomain", "track", "domain", "category", "theme", "stream"],
  },
  {
    id: "problem_statement",
    label: "Problem Statement (Code/ID)",
    category: "core",
    required: false,
    description: "Target problem identifier (e.g. PS-01, PS-04)",
    aliases: ["problemstatement", "problem", "ps", "pscode", "challenge", "challengeid", "psid"],
  },

  // 2. Links & Artifacts
  {
    id: "github_url",
    label: "GitHub Repository URL",
    category: "links",
    required: true,
    description: "Public source code repository for automated code inspection",
    aliases: ["githuburl", "github", "repository", "repo", "git", "gitrepo", "githublink"],
  },
  {
    id: "website_url",
    label: "Website / Live Demo URL",
    category: "links",
    required: false,
    description: "Deployed web application or accessible demo",
    aliases: ["websiteurl", "website", "deployedurl", "url", "demo", "demourl", "appurl", "liveurl", "demolink"],
  },
  {
    id: "pdf_url",
    label: "Pitch Deck / PDF (Google Drive Link)",
    category: "links",
    required: false,
    description: "Google Drive or direct link to project presentation deck",
    aliases: [
      "pitchdeckpdfgoogledrivelink",
      "pitchdeckgoogledrivelink",
      "googledrivelink",
      "pitchdecklink",
      "pdflink",
      "pdfurl",
      "pitchdeck",
      "pdf",
      "drivelink",
      "decklink",
      "presentationlink",
    ],
  },

  // 3. Team Members (1–4)
  {
    id: "member_1_name",
    label: "Member 1 Name (Team Lead)",
    category: "members",
    required: true,
    description: "Primary student coordinator / team leader name",
    aliases: [
      "member1name",
      "member1",
      "member_1_name",
      "member_1",
      "leadername",
      "leadname",
      "teammember1",
      "teammember1name",
      "student1name",
      "student1",
    ],
  },
  {
    id: "member_1_email",
    label: "Member 1 Email",
    category: "members",
    required: false,
    description: "Team leader email address",
    aliases: [
      "member1email",
      "member1mail",
      "member_1_email",
      "member_1mail",
      "teammember1email",
      "leaderemail",
      "leademail",
      "student1email",
    ],
  },
  {
    id: "member_2_name",
    label: "Member 2 Name",
    category: "members",
    required: true,
    description: "Second team member name",
    aliases: [
      "member2name",
      "member2",
      "member_2_name",
      "member_2",
      "teammember2",
      "teammember2name",
      "student2name",
      "student2",
    ],
  },
  {
    id: "member_2_email",
    label: "Member 2 Email",
    category: "members",
    required: false,
    description: "Second team member email",
    aliases: [
      "member2email",
      "member2mail",
      "member_2_email",
      "member_2mail",
      "teammember2email",
      "student2email",
    ],
  },
  {
    id: "member_3_name",
    label: "Member 3 Name (Optional)",
    category: "members",
    required: false,
    description: "Third team member name",
    aliases: [
      "member3name",
      "member3",
      "member_3_name",
      "member_3",
      "teammember3",
      "teammember3name",
      "student3name",
      "student3",
      "3rdmembername",
      "3rdmember",
    ],
  },
  {
    id: "member_3_email",
    label: "Member 3 Email (Optional)",
    category: "members",
    required: false,
    description: "Third team member email",
    aliases: [
      "member3email",
      "member3mail",
      "member_3_email",
      "member_3mail",
      "teammember3email",
      "student3email",
      "3rdmemberemail",
    ],
  },
  {
    id: "member_4_name",
    label: "Member 4 Name (Optional)",
    category: "members",
    required: false,
    description: "Fourth team member name",
    aliases: [
      "member4name",
      "member4",
      "member_4_name",
      "member_4",
      "teammember4",
      "teammember4name",
      "student4name",
      "student4",
      "4thmembername",
      "4thmember",
    ],
  },
  {
    id: "member_4_email",
    label: "Member 4 Email (Optional)",
    category: "members",
    required: false,
    description: "Fourth team member email",
    aliases: [
      "member4email",
      "member4mail",
      "member_4_email",
      "member_4mail",
      "teammember4email",
      "student4email",
      "4thmemberemail",
    ],
  },

  // 4. Special Mappings
  {
    id: "custom_metadata",
    label: "Custom Metadata (Store in Remarks)",
    category: "special",
    required: false,
    description: "Preserve column value as structured custom metadata in team remarks",
    aliases: ["remarks", "notes", "comments", "batch", "section", "semester", "year"],
  },
  {
    id: "ignore",
    label: "Ignore / Do Not Import",
    category: "special",
    required: false,
    description: "Exclude this Excel column completely from import",
    aliases: ["timestamp", "serial", "sno", "id", "index", "submittedat"],
  },
];

/** Mandatory portal fields that must be mapped to a selected column */
export const REQUIRED_PORTAL_FIELDS: PortalFieldDef[] = PORTAL_FIELDS.filter((f) => f.required);

export const PORTAL_FIELD_MAP = new Map<PortalFieldId, PortalFieldDef>(
  PORTAL_FIELDS.map((f) => [f.id, f])
);

/**
 * Normalizes string for fuzzy header comparison (lowercased, alphanumeric only)
 */
export function normalizeHeaderKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Auto-detect matching portal field for a given Excel header string
 */
export function detectFieldForHeader(header: string): PortalFieldId {
  const norm = normalizeHeaderKey(header);
  if (!norm) return "ignore";

  for (const field of PORTAL_FIELDS) {
    if (field.id === "ignore" || field.id === "custom_metadata") continue;
    if (field.aliases.includes(norm)) {
      return field.id;
    }
  }

  // Regex-based robust member matching
  if (/member.*1.*(email|mail)/i.test(header) || /1.*member.*(email|mail)/i.test(header) || /lead.*(email|mail)/i.test(header)) return "member_1_email";
  if (/member.*1/i.test(header) || /1.*member/i.test(header) || /leader/i.test(header) || /leadname/i.test(header)) return "member_1_name";

  if (/member.*2.*(email|mail)/i.test(header) || /2.*member.*(email|mail)/i.test(header)) return "member_2_email";
  if (/member.*2/i.test(header) || /2.*member/i.test(header)) return "member_2_name";

  if (/member.*3.*(email|mail)/i.test(header) || /3.*member.*(email|mail)/i.test(header)) return "member_3_email";
  if (/member.*3/i.test(header) || /3.*member/i.test(header)) return "member_3_name";

  if (/member.*4.*(email|mail)/i.test(header) || /4.*member.*(email|mail)/i.test(header)) return "member_4_email";
  if (/member.*4/i.test(header) || /4.*member/i.test(header)) return "member_4_name";

  // Secondary substring / keyword matching for common variations
  if (norm.includes("teamname") || norm === "team") return "name";
  if (norm.includes("projecttitle") || norm === "title") return "project_title";
  if (norm.includes("projectdesc") || norm.includes("description")) return "project_description";
  if (norm.includes("college") || norm.includes("institute") || norm.includes("university")) return "college";
  if (norm.includes("github")) return "github_url";
  if (norm.includes("website") || norm.includes("deployed") || norm.includes("demo")) return "website_url";
  if (norm.includes("pitchdeck") || norm.includes("drivelink") || (norm.includes("pdf") && norm.includes("link"))) return "pdf_url";
  if (norm.includes("track") || norm.includes("domain")) return "track";
  if (norm.includes("problem") || norm.includes("pscode")) return "problem_statement";

  // Ignore timestamps and internal IDs by default
  if (norm === "timestamp" || norm === "sno" || norm === "serialnumber" || norm === "id") {
    return "ignore";
  }

  // If unrecognized, default to custom_metadata
  return "custom_metadata";
}

/**
 * Checks if an Excel header has an unambiguous, automatic match to a portal field
 */
export function isUnambiguousMapping(header: string, targetField: PortalFieldId): boolean {
  if (targetField === "ignore" || targetField === "custom_metadata") return false;
  const norm = normalizeHeaderKey(header);
  const def = PORTAL_FIELD_MAP.get(targetField);
  if (!def) return false;
  return def.aliases.includes(norm) || detectFieldForHeader(header) === targetField;
}

export interface ColumnMappingState {
  [excelHeader: string]: {
    targetField: PortalFieldId;
    selected: boolean;
  };
}

/**
 * Initializes default mapping state for an array of detected Excel headers
 */
export function createDefaultColumnMapping(detectedHeaders: string[]): ColumnMappingState {
  const state: ColumnMappingState = {};
  const mappedTargets = new Set<PortalFieldId>();

  for (const header of detectedHeaders) {
    const detected = detectFieldForHeader(header);
    // Don't auto-assign the same non-metadata field twice
    let target = detected;
    if (target !== "custom_metadata" && target !== "ignore" && mappedTargets.has(target)) {
      target = "custom_metadata";
    }

    if (target !== "ignore" && target !== "custom_metadata") {
      mappedTargets.add(target);
    }

    state[header] = {
      targetField: target,
      selected: target !== "ignore",
    };
  }

  // Ensure all 4 team member positions (Slots 1–4) are explicitly represented in mapping
  const rosterSlots: { id: PortalFieldId; defaultHeader: string }[] = [
    { id: "member_3_name", defaultHeader: "Member 3 Name (Optional)" },
    { id: "member_3_email", defaultHeader: "Member 3 Email (Optional)" },
    { id: "member_4_name", defaultHeader: "Member 4 Name (Optional)" },
    { id: "member_4_email", defaultHeader: "Member 4 Email (Optional)" },
  ];

  for (const slot of rosterSlots) {
    if (!mappedTargets.has(slot.id)) {
      state[slot.defaultHeader] = {
        targetField: slot.id,
        selected: true,
      };
      mappedTargets.add(slot.id);
    }
  }

  return state;
}

export interface DuplicateMappingConflict {
  targetField: PortalFieldId;
  fieldLabel: string;
  headers: string[];
}

/**
 * Validates whether all mandatory portal fields are mapped and detects duplicate mappings
 */
export function validateColumnMapping(mapping: ColumnMappingState): {
  isValid: boolean;
  missingRequiredFields: PortalFieldDef[];
  duplicateFieldMappings: DuplicateMappingConflict[];
  mappedFieldCount: number;
  selectedColumnCount: number;
} {
  const targetToHeaders = new Map<PortalFieldId, string[]>();
  let selectedColumnCount = 0;

  for (const header in mapping) {
    const item = mapping[header];
    if (item && item.selected && item.targetField !== "ignore") {
      selectedColumnCount++;
      if (item.targetField !== "custom_metadata") {
        const list = targetToHeaders.get(item.targetField) ?? [];
        list.push(header);
        targetToHeaders.set(item.targetField, list);
      }
    }
  }

  // Check missing mandatory fields
  const missingRequiredFields = REQUIRED_PORTAL_FIELDS.filter(
    (req) => !targetToHeaders.has(req.id)
  );

  // Check duplicate target mappings
  const duplicateFieldMappings: DuplicateMappingConflict[] = [];
  for (const [target, headers] of targetToHeaders.entries()) {
    if (headers.length > 1) {
      const fieldDef = PORTAL_FIELD_MAP.get(target);
      duplicateFieldMappings.push({
        targetField: target,
        fieldLabel: fieldDef?.label ?? target,
        headers,
      });
    }
  }

  const isValid = missingRequiredFields.length === 0 && duplicateFieldMappings.length === 0;

  return {
    isValid,
    missingRequiredFields,
    duplicateFieldMappings,
    mappedFieldCount: targetToHeaders.size,
    selectedColumnCount,
  };
}

export type ParsedTeamMember = {
  name: string;
  email: string;
};

export type ParsedTeamRow = {
  id: string;
  rowIndex: number;
  name: string;
  college: string;
  email: string;
  track: string;
  problem_statement: string;
  project_title: string;
  project_description: string;
  github_url: string;
  website_url: string;
  pdf_url: string;
  members: ParsedTeamMember[];
  customMetadata: Record<string, string>;
  mappedFields: Set<PortalFieldId>;
  issues: string[];
  duplicateInSheet: boolean;
  alreadyInDb: boolean;
  isValid: boolean;
  status: "ready" | "existing" | "duplicate" | "invalid";
};

export const sanitizeUrl = (raw: string, fallback = ""): string => {
  let val = raw.trim();
  if (!val) return fallback;
  if (/^https?:\/\//i.test(val)) return val;
  if (/^(www\.)?github\.com/i.test(val)) return `https://${val}`;
  if (/^[a-z0-9-]+\.[a-z]{2,}/i.test(val)) return `https://${val}`;
  return val;
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Generates parsed, validated, and normalized team rows based on explicit column mappings
 */
export function parseRowsWithMapping(
  raw: Record<string, string>[],
  mapping: ColumnMappingState,
  existingTeams: { name: string; email?: string }[]
): ParsedTeamRow[] {
  // Build inverted map: field -> excelHeader
  const fieldToHeader: Partial<Record<PortalFieldId, string>> = {};
  const customHeaders: string[] = [];
  const selectedPortalFields = new Set<PortalFieldId>();

  for (const [header, item] of Object.entries(mapping)) {
    if (item.selected && item.targetField !== "ignore") {
      if (item.targetField === "custom_metadata") {
        customHeaders.push(header);
      } else {
        fieldToHeader[item.targetField] = header;
        selectedPortalFields.add(item.targetField);
      }
    }
  }

  const existingNames = new Set(existingTeams.map((t) => t.name.toLowerCase().trim()));
  const seenNames = new Set<string>();

  return raw.map((r, idx) => {
    const getValue = (f: PortalFieldId): string => {
      const header = fieldToHeader[f];
      return header && r[header] != null ? String(r[header]).trim() : "";
    };

    const teamName = getValue("name");
    const teamEmail = getValue("email");
    const projectTitle = getValue("project_title");
    const projectDesc = getValue("project_description");
    const college = getValue("college");
    const track = getValue("track");
    const problem_statement = getValue("problem_statement");
    const rawGithub = getValue("github_url");
    const github_url = sanitizeUrl(rawGithub);
    let rawWebsite = getValue("website_url");
    let website_url = sanitizeUrl(rawWebsite);

    // If website URL was not mapped/provided, fallback to github_url if available
    if (!website_url && github_url) {
      website_url = github_url;
    }

    const rawPdf = getValue("pdf_url");
    const pdf_url = rawPdf ? sanitizeUrl(rawPdf) : "";

    const issues: string[] = [];
    const members: ParsedTeamMember[] = [];
    const memberEmails: string[] = [];

    // Extract all 4 member slots
    for (let i = 1; i <= 4; i++) {
      const nameKey: PortalFieldId = `member_${i}_name` as PortalFieldId;
      const emailKey: PortalFieldId = `member_${i}_email` as PortalFieldId;

      const mName = getValue(nameKey);
      const mEmail = getValue(emailKey);

      // Incomplete member check: email provided without name
      if (!mName && mEmail) {
        issues.push(`Member ${i} email provided (${mEmail}) but Member ${i} name is missing`);
      }

      if (mName) {
        if (mEmail) {
          if (!EMAIL_REGEX.test(mEmail)) {
            issues.push(`Member ${i} (${mName}) has an invalid email format (${mEmail})`);
          } else {
            const emailLower = mEmail.toLowerCase().trim();
            if (memberEmails.includes(emailLower)) {
              issues.push(`Duplicate member email (${mEmail}) used multiple times within the team`);
            } else {
              memberEmails.push(emailLower);
            }
          }
        }
        members.push({ name: mName, email: mEmail });
      }
    }

    // Support delimited string in a single 'Members' column if individual columns not found (legacy fallback)
    if (members.length === 0) {
      const legacyHeader = Object.keys(r).find((k) =>
        ["members", "teammembers", "allmembers", "roster"].includes(normalizeHeaderKey(k))
      );
      if (legacyHeader && r[legacyHeader]) {
        const parts = String(r[legacyHeader]).split(/[;|]/);
        parts.slice(0, 4).forEach((part) => {
          const [n, e] = part.split(/[<>,]/).map((s) => s.trim());
          if (n) {
            members.push({ name: n, email: e ?? "" });
          }
        });
      }
    }

    // Extract custom metadata columns
    const customMetadata: Record<string, string> = {};
    for (const h of customHeaders) {
      const val = r[h]?.trim();
      if (val) {
        customMetadata[h] = val;
      }
    }

    // Validation rules
    if (!teamName) issues.push("Missing team name");
    if (!teamEmail) {
      issues.push("Missing team email");
    } else if (!EMAIL_REGEX.test(teamEmail)) {
      issues.push("Invalid team email format");
    }

    if (!projectTitle) issues.push("Missing project title");
    if (!projectDesc) issues.push("Missing project description");

    if (!github_url) {
      issues.push("Missing GitHub URL");
    } else if (!/^https?:\/\/(www\.)?github\.com\//i.test(github_url)) {
      issues.push("Invalid GitHub URL (must start with https://github.com/)");
    }

    if (!website_url) {
      issues.push("Missing website URL");
    } else if (!/^https?:\/\//i.test(website_url)) {
      issues.push("Invalid website URL");
    }

    // Member 1 (Lead) is required
    if (!members.length) {
      issues.push("Member 1 (Lead) is required");
    }

    // Member 2 is required if Member 2 Name column was selected in mapping
    if (selectedPortalFields.has("member_2_name") && members.length < 2) {
      issues.push("Member 2 Name is required");
    }

    // Duplicate checks
    const nameKey = teamName.toLowerCase().trim();
    const duplicateInSheet = nameKey ? seenNames.has(nameKey) : false;
    if (nameKey) seenNames.add(nameKey);

    const alreadyInDb = nameKey ? existingNames.has(nameKey) : false;
    const isValid = issues.length === 0;

    let status: "ready" | "existing" | "duplicate" | "invalid" = "ready";
    if (duplicateInSheet) {
      status = "duplicate";
    } else if (alreadyInDb) {
      status = "existing";
    } else if (!isValid) {
      status = "invalid";
    }

    return {
      id: `row_${idx + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rowIndex: idx + 2,
      name: teamName,
      college: college || (teamEmail.toLowerCase().includes("sapthagiri") ? "Sapthagiri College of Engineering" : ""),
      email: teamEmail,
      track,
      problem_statement,
      project_title: projectTitle || (problem_statement ? `[${problem_statement}] Proposal` : ""),
      project_description: projectDesc,
      github_url,
      website_url,
      pdf_url,
      members,
      customMetadata,
      mappedFields: selectedPortalFields,
      issues,
      duplicateInSheet,
      alreadyInDb,
      isValid,
      status,
    };
  });
}
