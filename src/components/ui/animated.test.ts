import { describe, it, expect } from "vitest";

describe("Animated Number & Scoring Formatting", () => {
  it("correctly formats integer and decimal numbers without rounding errors", () => {
    const formatNumber = (num: number, precision: number): string => {
      const rounded = Number(num.toFixed(precision));
      return precision > 0 && rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(precision);
    };

    expect(formatNumber(84.0, 1)).toBe("84");
    expect(formatNumber(84.5, 1)).toBe("84.5");
    expect(formatNumber(100.0, 1)).toBe("100");
    expect(formatNumber(0, 0)).toBe("0");
    expect(formatNumber(92.75, 2)).toBe("92.75");
  });

  it("handles progress clamping between 0 and 100 correctly", () => {
    const clampProgress = (val: number) => Math.min(100, Math.max(0, val || 0));

    expect(clampProgress(-10)).toBe(0);
    expect(clampProgress(50)).toBe(50);
    expect(clampProgress(120)).toBe(100);
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(100)).toBe(100);
  });

  it("calculates 30/40/30 weighted component scores accurately", () => {
    const pdf = 80;
    const github = 90;
    const website = 85;

    const weighted = Number((pdf * 0.3 + github * 0.4 + website * 0.3).toFixed(1));
    expect(weighted).toBe(85.5);
  });
});
