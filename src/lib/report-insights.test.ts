import { describe, it, expect, beforeEach } from "vitest";
import {
  generateEvidenceBasedInsights,
  generateEvaluationInsights,
  getOrGenerateReportInsights,
  REPORT_INSIGHTS_CACHE_PREFIX,
} from "./report-insights";
import type { TeamRow } from "./queries";
import type { PlagiarismResult } from "./plagiarism";

function makeMockTeam(overrides?: Partial<TeamRow>): TeamRow {
  return {
    id: "team-test-123",
    name: "Team Alpha",
    email: "alpha@sapthagiri.edu",
    project_title: "AI-Powered Automated Evaluation Platform",
    project_description: "A comprehensive multimodal evaluator with verifiable rubrics.",
    github_url: "https://github.com/team-alpha/repo",
    website_url: "https://team-alpha.vercel.app",
    pdf_path: "team-alpha.pdf",
    pdf_text: "Technical architecture and proposal documentation with complete benchmark results.",
    final_override: null,
    override_reason: null,
    final_status: "approved",
    remarks: "Excellent proposal",
    created_at: "2026-11-16T10:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
    evals: {
      pdf: {
        id: "eval-pdf-1",
        team_id: "team-test-123",
        component: "pdf",
        status: "approved",
        ai_score: 85,
        final_score: 85,
        max_score: 100,
        confidence: 0.95,
        summary: "Excellent architectural documentation with clear metrics.",
        created_at: "2026-11-16T10:05:00Z",
        updated_at: "2026-11-16T10:05:00Z",
        approved_at: "2026-11-16T10:10:00Z",
        approved_by: "admin",
        error: null,
        model: "gemini-3.1-flash-lite",
        stale: false,
      },
      github: {
        id: "eval-gh-1",
        team_id: "team-test-123",
        component: "github",
        status: "approved",
        ai_score: 88,
        final_score: 88,
        max_score: 100,
        confidence: 0.92,
        summary: "Clean modular React/Node architecture with tests.",
        created_at: "2026-11-16T10:06:00Z",
        updated_at: "2026-11-16T10:06:00Z",
        approved_at: "2026-11-16T10:10:00Z",
        approved_by: "admin",
        error: null,
        model: "gemini-3.1-flash-lite",
        stale: false,
      },
      website: {
        id: "eval-web-1",
        team_id: "team-test-123",
        component: "website",
        status: "approved",
        ai_score: 82,
        final_score: 82,
        max_score: 100,
        confidence: 0.90,
        summary: "Responsive deployment with live dashboard.",
        created_at: "2026-11-16T10:07:00Z",
        updated_at: "2026-11-16T10:07:00Z",
        approved_at: "2026-11-16T10:10:00Z",
        approved_by: "admin",
        error: null,
        model: "gemini-3.1-flash-lite",
        stale: false,
      },
    },
    aiFinal: 85.3,
    approvedFinal: 85.3,
    officialFinal: 85.3,
    missing: [],
    overall: "approved",
    ...overrides,
  };
}

describe("Evaluation Insights Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates structured evidence-based strengths for high-performing teams", () => {
    const team = makeMockTeam();
    const insights = generateEvidenceBasedInsights(team);

    expect(insights.strengths.length).toBeGreaterThanOrEqual(2);
    // Structured properties must be present
    expect(insights.strengths[0]).toHaveProperty("title");
    expect(insights.strengths[0]).toHaveProperty("description");
    expect(insights.strengths[0]).toHaveProperty("source");

    const titlesAndDescs = insights.strengths.map((s) => `${s.title} ${s.description}`).join(" ");
    expect(titlesAndDescs.toLowerCase()).toMatch(/(specification|technical|proposal|repository|code|deployment|prototype)/);
  });

  it("identifies specific areas to improve when component scores are low", () => {
    const weakTeam = makeMockTeam({
      evals: {
        pdf: {
          id: "eval-pdf-weak",
          team_id: "team-test-123",
          component: "pdf",
          status: "done",
          ai_score: 45,
          final_score: 45,
          max_score: 100,
          confidence: 0.8,
          summary: "Sparse technical proposal without benchmarks.",
          created_at: "2026-11-16T10:00:00Z",
          updated_at: "2026-11-16T10:00:00Z",
          approved_at: null,
          approved_by: null,
          error: null,
          model: "gemini-3.1-flash-lite",
          stale: false,
        },
        github: {
          id: "eval-gh-weak",
          team_id: "team-test-123",
          component: "github",
          status: "done",
          ai_score: 50,
          final_score: 50,
          max_score: 100,
          confidence: 0.85,
          summary: "Missing test coverage and messy layout.",
          created_at: "2026-11-16T10:00:00Z",
          updated_at: "2026-11-16T10:00:00Z",
          approved_at: null,
          approved_by: null,
          error: null,
          model: "gemini-3.1-flash-lite",
          stale: false,
        },
      },
      officialFinal: 47.5,
      aiFinal: 47.5,
    });

    const insights = generateEvaluationInsights(weakTeam);

    expect(insights.areasToImprove.length).toBeGreaterThanOrEqual(2);
    const areaTitles = insights.areasToImprove.map((a) => `${a.title} ${a.description}`).join(" ");
    expect(areaTitles.toLowerCase()).toMatch(/(documentation|proposal|code quality|test|coverage)/);

    expect(insights.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(insights.suggestions[0]).toHaveProperty("relatedIssue");
  });

  it("flags plagiarism overlap and generates remediation suggestions", () => {
    const team = makeMockTeam();
    const plagResult: PlagiarismResult = {
      teamId: team.id,
      teamName: team.name,
      scanStatus: "flagged_similarity",
      similarityScore: 48,
      pdfSimilarity: 40,
      githubSimilarity: 52,
      websiteSimilarity: 10,
      overallSimilarity: 48,
      isFlagged: true,
      severity: "medium",
      confidence: 0.92,
      suspectedSource: "Peer Repository",
      flaggedReason: "52% code logic overlap detected with Team Beta",
      recommendation: "Elevated similarity index of 48% detected across codebase. Manual code inspection and jury audit are recommended before final certification.",
      methodology: "Multi-modal token-shingling Jaccard coefficient and repository cross-matching.",
      scanTimestamp: "2026-11-16T12:00:00Z",
      matchedWith: [],
      duplicateRepo: false,
      notes: [],
      evidence: [],
      boilerplateExcluded: true,
      adminDecision: "pending_review",
    };

    const insights = generateEvidenceBasedInsights(team, { pdf: 30, github: 40, website: 30 }, plagResult);

    const hasPlagAlert = insights.areasToImprove.some(
      (a) => a.title.includes("Similarity Alert") || a.description.includes("48%")
    );
    expect(hasPlagAlert).toBe(true);

    const hasRemediation = insights.suggestions.some(
      (s) =>
        s.title.toLowerCase().includes("boilerplate") ||
        s.description.toLowerCase().includes("citations") ||
        s.relatedIssue?.toLowerCase().includes("similarity")
    );
    expect(hasRemediation).toBe(true);
  });

  it("persists and reuses cached insights in localStorage", () => {
    const team = makeMockTeam();
    const insights1 = getOrGenerateReportInsights(team);

    // Verify localStorage has cached item with version prefix
    const raw = localStorage.getItem(`${REPORT_INSIGHTS_CACHE_PREFIX}${team.id}`);
    expect(raw).toBeTruthy();

    // Call again, should retrieve the same generatedAt
    const insights2 = getOrGenerateReportInsights(team);
    expect(insights2.generatedAt).toBe(insights1.generatedAt);

    // If forceRegenerate is true, it should generate fresh
    const insights3 = getOrGenerateReportInsights(team, undefined, undefined, true);
    expect(insights3.strengths.length).toBe(insights1.strengths.length);
  });
});
