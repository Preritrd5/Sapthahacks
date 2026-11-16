import { describe, expect, it } from "vitest";
import {
  ADMIN_EMAIL,
  isAllowedAccount,
  submissionSchema,
  validatePdf,
  checkPdf,
  MAX_PDF_BYTES,
} from "./submission";

describe("Team Creation & Authorization Validation", () => {
  it("enforces that strictly TeamInoSap26@gmail.com is authorized", () => {
    expect(isAllowedAccount("TeamInoSap26@gmail.com")).toBe(true);
    expect(isAllowedAccount("teaminosap26@gmail.com")).toBe(true);
    expect(isAllowedAccount("  TeamInoSap26@gmail.com  ")).toBe(true);

    expect(isAllowedAccount("hacker@example.com")).toBe(false);
    expect(isAllowedAccount("admin@sapthagiri.edu")).toBe(false);
    expect(isAllowedAccount("")).toBe(false);
    expect(isAllowedAccount("teaminosap26@gmail.co")).toBe(false);
  });

  it("validates that all required project fields satisfy schema constraints", () => {
    const validTeam = {
      name: "Prerit R Deyagond",
      email: "preritrd5@gmail.com",
      project_title: "[PS-01] AI Powered Adaptive Traffic & Mobility Optimization",
      project_description:
        "Design and build an intelligent traffic management system that uses computer vision and real-time sensor data.",
      github_url: "https://github.com/Preritrd5/BhuSetu3D",
      website_url: "https://bhusetu3d.vercel.app/",
    };

    const result = submissionSchema.safeParse(validTeam);
    expect(result.success).toBe(true);
  });

  it("rejects invalid GitHub repository URLs", () => {
    const invalidTeam = {
      name: "Prerit R Deyagond",
      email: "preritrd5@gmail.com",
      project_title: "Adaptive Traffic",
      project_description: "Valid description",
      github_url: "https://gitlab.com/user/repo", // Not GitHub!
      website_url: "https://bhusetu3d.vercel.app/",
    };

    const result = submissionSchema.safeParse(invalidTeam);
    expect(result.success).toBe(false);
  });

  it("strictly enforces 3 MB ceiling on project PDFs", () => {
    expect(() =>
      validatePdf({
        name: "presentation.pdf",
        type: "application/pdf",
        size: MAX_PDF_BYTES,
      })
    ).not.toThrow();

    expect(() =>
      validatePdf({
        name: "presentation.pdf",
        type: "application/pdf",
        size: MAX_PDF_BYTES + 1,
      })
    ).toThrow("PDF must be no larger than 3 MB");

    expect(() =>
      validatePdf({
        name: "code.zip",
        type: "application/zip",
        size: 1024,
      })
    ).toThrow("Only PDF files are allowed");
  });
});
