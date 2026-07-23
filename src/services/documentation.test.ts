// path: src/services/documentation.test.ts
import { describe, it, expect, vi } from "vitest";
import { withRetry, isSectionOutdated, DocGenerationError } from "./documentation";
import type { DocumentationSection } from "@/lib/documentation/types";

describe("withRetry", () => {
  it("returns the result immediately on success, without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { backoffMs: [1] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient error (e.g. 503) up to maxAttempts, then succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new DocGenerationError("Gemini API error: 503", 503))
      .mockRejectedValueOnce(new DocGenerationError("Gemini API error: 503", 503))
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { backoffMs: [1, 1, 1] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after exhausting maxAttempts on a persistent transient error", async () => {
    const fn = vi.fn().mockRejectedValue(new DocGenerationError("Gemini API error: 429", 429));
    await expect(withRetry(fn, { maxAttempts: 3, backoffMs: [1, 1] })).rejects.toThrow("Gemini API error: 429");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a non-retryable client error (e.g. 400 validation)", async () => {
    const fn = vi.fn().mockRejectedValue(new DocGenerationError("section_key must be one of: ...", 400));
    await expect(withRetry(fn, { backoffMs: [1, 1, 1] })).rejects.toThrow("section_key must be one of");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a 401/404 (auth/not-found are never transient)", async () => {
    const fn401 = vi.fn().mockRejectedValue(new DocGenerationError("Not authenticated", 401));
    await expect(withRetry(fn401, { backoffMs: [1] })).rejects.toThrow();
    expect(fn401).toHaveBeenCalledTimes(1);

    const fn404 = vi.fn().mockRejectedValue(new DocGenerationError("Project not found", 404));
    await expect(withRetry(fn404, { backoffMs: [1] })).rejects.toThrow();
    expect(fn404).toHaveBeenCalledTimes(1);
  });

  it("treats an error with no status (e.g. a network drop) as retryable", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { backoffMs: [1] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("isSectionOutdated", () => {
  const base: DocumentationSection = {
    id: "s1", project_id: "p1", section_key: "overview", title: "Overview",
    content_md: "# Overview", content_json: null, source: "ai", has_manual_edits: false,
    source_fingerprint: "fp-1", generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  it("is false when the section was never AI-generated (no baseline fingerprint)", () => {
    expect(isSectionOutdated({ ...base, source_fingerprint: null }, "fp-2")).toBe(false);
  });

  it("is false when the section's fingerprint matches the current one", () => {
    expect(isSectionOutdated(base, "fp-1")).toBe(false);
  });

  it("is true when the project's fingerprint has moved on", () => {
    expect(isSectionOutdated(base, "fp-2")).toBe(true);
  });

  it("is false for a section that doesn't exist yet", () => {
    expect(isSectionOutdated(undefined, "fp-2")).toBe(false);
  });
});
