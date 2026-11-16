import { describe, it, expect } from "vitest";
import {
  runFastPlagiarismCheck,
  calculateSimilarity,
  runComprehensivePlagiarismScan,
  PLAGIARISM_THRESHOLDS,
} from "./plagiarism";
import { type TeamRow } from "./queries";

describe("Plagiarism & Originality Detection", () => {
  it("defines institutional threshold constants accurately", () => {
    expect(PLAGIARISM_THRESHOLDS.LOW_BASELINE).toBe(20);
    expect(PLAGIARISM_THRESHOLDS.WARNING_REVIEW).toBe(35);
    expect(PLAGIARISM_THRESHOLDS.HIGH_SIMILARITY).toBe(60);
    expect(PLAGIARISM_THRESHOLDS.DUPLICATE_REPO).toBe(95);
  });

  it("computes text token similarity accurately using Jaccard index", () => {
    const textA = "AI powered agricultural yield prediction system using satellite imagery and IoT sensors.";
    const textB = "AI powered agricultural crop yield prediction platform utilizing satellite imagery and IoT sensors.";
    const sim = calculateSimilarity(textA, textB);

    expect(sim).toBeGreaterThan(50);
  });

  it("detects identical GitHub repository URLs across different teams", () => {
    const mockTeams: TeamRow[] = [
      {
        id: "team-1",
        name: "Alpha Innovators",
        project_title: "Smart Irrigation",
        github_url: "https://github.com/example/smart-irrigation",
        project_description: "An automated watering system based on soil moisture.",
        final_status: "pending",
        evals: {},
        missing: [],
      } as any,
      {
        id: "team-2",
        name: "Beta Innovators",
        project_title: "Automated Watering",
        github_url: "https://github.com/example/smart-irrigation", // identical repo!
        project_description: "An automated watering system based on soil moisture and temperature.",
        final_status: "pending",
        evals: {},
        missing: [],
      } as any,
    ];

    const results = runFastPlagiarismCheck(mockTeams);
    const team1Result = results.get("team-1");
    const team2Result = results.get("team-2");

    expect(team1Result?.isFlagged).toBe(true);
    expect(team1Result?.severity).toBe("high");
    expect(team1Result?.matchedWith.some((m) => m.teamName === "Beta Innovators")).toBe(true);
    expect(team2Result?.isFlagged).toBe(true);
  });

  it("marks empty artifact submissions as unavailable with null score rather than false 0% clean", () => {
    const emptyTeam: TeamRow = {
      id: "team-empty",
      name: "Empty Team",
      project_title: "",
      project_description: "",
      github_url: "",
      website_url: "",
      pdf_path: null,
      pdf_text: null,
      evals: {},
      missing: ["pdf", "github", "website"],
    } as any;

    const results = runComprehensivePlagiarismScan([emptyTeam]);
    const result = results.get("team-empty")!;
    expect(result.scanStatus).toBe("unavailable");
    expect(result.similarityScore).toBeNull();
    expect(result.isFlagged).toBe(false);
    expect(result.recommendation.toLowerCase()).toContain("unavailable");
  });

  it("verifies genuine unique submissions as completed_clean with proper methodology note", () => {
    const uniqueTeam: TeamRow = {
      id: "team-unique",
      name: "Quantum Cryptographers",
      project_title: "Post-Quantum Lattice-Based Key Exchange",
      project_description: "Implementing Module-LWE key encapsulation mechanisms with hardware acceleration on FPGA.",
      github_url: "https://github.com/quantum/m-lwe-fpga",
      website_url: "https://quantum-lattice.org",
      pdf_path: "quantum.pdf",
      pdf_text: "Cryptographic specifications and lattice dimension parameter tables.",
      evals: {},
      missing: [],
    } as any;

    const otherTeam: TeamRow = {
      id: "team-other",
      name: "Smart Waste System",
      project_title: "IoT Garbage Can Fill Level Sensor",
      project_description: "Ultrasonic sensor mounted on municipal trash bins sending SMS alerts to municipal trucks.",
      github_url: "https://github.com/smartwaste/bin-tracker",
      website_url: "https://smartwaste.city",
      pdf_path: "waste.pdf",
      pdf_text: "Ultrasonic HC-SR04 pinout and Arduino GSM shield schematic.",
      evals: {},
      missing: [],
    } as any;

    const results = runComprehensivePlagiarismScan([uniqueTeam, otherTeam]);
    const result = results.get("team-unique")!;
    expect(result.scanStatus).toBe("completed_clean");
    expect(result.similarityScore).not.toBeNull();
    expect(result.similarityScore!).toBeLessThan(PLAGIARISM_THRESHOLDS.LOW_BASELINE);
    expect(result.isFlagged).toBe(false);
    expect(result.recommendation).toContain("No significant cross-team similarity detected");
    expect(result.methodology).toContain("Jaccard");
  });

  it("flags identical repository submissions as duplicate_repo with critical severity", () => {
    const teamA: TeamRow = {
      id: "team-a",
      name: "Dev Team A",
      project_title: "Fintech Ledger",
      github_url: "https://github.com/org/fintech-app",
      project_description: "Double entry bookkeeping core.",
      evals: {},
      missing: [],
    } as any;

    const teamB: TeamRow = {
      id: "team-b",
      name: "Dev Team B",
      project_title: "Fintech App Copy",
      github_url: "https://github.com/org/fintech-app", // exact copy
      project_description: "Double entry bookkeeping core.",
      evals: {},
      missing: [],
    } as any;

    const results = runComprehensivePlagiarismScan([teamA, teamB]);
    const resultA = results.get("team-a")!;
    expect(resultA.scanStatus).toBe("duplicate_repo");
    expect(resultA.similarityScore).toBe(100);
    expect(resultA.isFlagged).toBe(true);
    expect(resultA.severity).toBe("high");
    expect(resultA.flaggedReason).toContain("Duplicate GitHub repository");
  });
});
