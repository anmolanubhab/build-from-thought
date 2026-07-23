// path: src/services/documentationBatch.test.ts
import { describe, it, expect } from "vitest";
import { computeTargetSections } from "./documentationBatch";
import { CORE_DOC_SECTION_KEYS } from "@/lib/documentation/registry";
import type { DocumentationSection, DocSectionKey } from "@/lib/documentation/types";

function section(overrides: Partial<DocumentationSection> & { section_key: DocSectionKey }): DocumentationSection {
  return {
    id: overrides.section_key, project_id: "p1", title: "T", content_md: "# T",
    content_json: null, source: "ai", has_manual_edits: false,
    source_fingerprint: "fp-1", generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeTargetSections", () => {
  it("targets every core section when nothing has been generated yet", () => {
    const targets = computeTargetSections({
      projectId: "p1", fingerprint: "fp-1", sectionsByKey: new Map(),
    });
    expect(targets).toEqual(CORE_DOC_SECTION_KEYS);
  });

  it("skips a section that's already up to date (same fingerprint, has content)", () => {
    const sectionsByKey = new Map<DocSectionKey, DocumentationSection>([
      ["overview", section({ section_key: "overview", source_fingerprint: "fp-1" })],
    ]);
    const targets = computeTargetSections({ projectId: "p1", fingerprint: "fp-1", sectionsByKey });
    expect(targets).not.toContain("overview");
    expect(targets).toContain("readme");
  });

  it("re-targets a section whose fingerprint is stale", () => {
    const sectionsByKey = new Map<DocSectionKey, DocumentationSection>([
      ["overview", section({ section_key: "overview", source_fingerprint: "fp-OLD" })],
    ]);
    const targets = computeTargetSections({ projectId: "p1", fingerprint: "fp-NEW", sectionsByKey });
    expect(targets).toContain("overview");
  });

  it("re-targets a section that exists but has empty content", () => {
    const sectionsByKey = new Map<DocSectionKey, DocumentationSection>([
      ["overview", section({ section_key: "overview", content_md: "   ", source_fingerprint: "fp-1" })],
    ]);
    const targets = computeTargetSections({ projectId: "p1", fingerprint: "fp-1", sectionsByKey });
    expect(targets).toContain("overview");
  });

  it("force ignores up-to-date status and targets everything", () => {
    const sectionsByKey = new Map<DocSectionKey, DocumentationSection>(
      CORE_DOC_SECTION_KEYS.map((key) => [key, section({ section_key: key, source_fingerprint: "fp-1" })]),
    );
    const targets = computeTargetSections({ projectId: "p1", fingerprint: "fp-1", sectionsByKey, force: true });
    expect(targets).toEqual(CORE_DOC_SECTION_KEYS);
  });

  it("never targets ai_explain or viva_mode — they need a picked audience/level", () => {
    const targets = computeTargetSections({ projectId: "p1", fingerprint: "fp-1", sectionsByKey: new Map(), force: true });
    expect(targets).not.toContain("ai_explain");
    expect(targets).not.toContain("viva_mode");
  });
});
