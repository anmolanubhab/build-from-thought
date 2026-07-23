// path: src/lib/documentation/registry.test.ts
import { describe, it, expect } from "vitest";
import { CORE_DOC_SECTION_KEYS, DOC_SECTION_KEYS, DOC_SECTIONS } from "./registry";

describe("CORE_DOC_SECTION_KEYS", () => {
  it("has exactly the 12 core sections, excluding ai_explain and viva_mode", () => {
    expect(CORE_DOC_SECTION_KEYS).toHaveLength(12);
    expect(CORE_DOC_SECTION_KEYS).not.toContain("ai_explain");
    expect(CORE_DOC_SECTION_KEYS).not.toContain("viva_mode");
  });

  it("is a subset of every registered section key", () => {
    for (const key of CORE_DOC_SECTION_KEYS) expect(DOC_SECTION_KEYS).toContain(key);
  });

  it("matches every DOC_SECTIONS entry tagged group: 'core'", () => {
    const expected = DOC_SECTIONS.filter((s) => s.group === "core").map((s) => s.key);
    expect(CORE_DOC_SECTION_KEYS).toEqual(expected);
  });
});
