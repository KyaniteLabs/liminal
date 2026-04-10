import { describe, it, expect } from "vitest";
import {
  KINETIC_SYSTEM_PROMPT,
  buildKineticPrompt,
} from "../../../src/generators/kinetic/kineticPrompt.js";

describe("KINETIC_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof KINETIC_SYSTEM_PROMPT).toBe("string");
    expect(KINETIC_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("contains @keyframes", () => {
    expect(KINETIC_SYSTEM_PROMPT).toContain("@keyframes");
  });

  it("contains 'NO JavaScript'", () => {
    expect(KINETIC_SYSTEM_PROMPT).toContain("NO JavaScript");
  });

  it("contains 'perpetual'", () => {
    expect(KINETIC_SYSTEM_PROMPT).toContain("perpetual");
  });

  it("contains '<!DOCTYPE html>'", () => {
    expect(KINETIC_SYSTEM_PROMPT).toContain("<!DOCTYPE html>");
  });
});

describe("buildKineticPrompt", () => {
  it("returns a string containing 'SPEC:'", () => {
    const result = buildKineticPrompt("rotating circles");
    expect(result).toContain("SPEC:");
  });

  it("returns a string containing the input spec", () => {
    const spec = "rotating circles";
    const result = buildKineticPrompt(spec);
    expect(result).toContain(spec);
  });

  it("returns different prompts for different specs", () => {
    const result1 = buildKineticPrompt("rotating circles");
    const result2 = buildKineticPrompt("pulsing waves");
    expect(result1).not.toBe(result2);
  });
});
