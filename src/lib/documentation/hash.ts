// path: src/lib/documentation/hash.ts
//
// Auto Sync: a cheap content fingerprint of "everything documentation could
// depend on" for a project. Computed client-side (SubtleCrypto, no server
// round-trip) whenever the Documentation workspace loads, then compared
// against each section's stored `source_fingerprint` to flag it outdated —
// this is what powers the "Documentation detects changes" requirement.

export interface FingerprintInput {
  files?: Record<string, string> | null;
  html?: string | null;
  css?: string | null;
  react_code?: string | null;
  plan?: Record<string, unknown> | null;
  databaseTables?: string[];
  deploymentStatuses?: string[];
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Deterministic fingerprint of the project's current documentable state. */
export async function computeProjectFingerprint(input: FingerprintInput): Promise<string> {
  const parts: string[] = [];

  if (input.files && Object.keys(input.files).length > 0) {
    for (const path of Object.keys(input.files).sort()) {
      parts.push(`F:${path}\n${input.files[path]}`);
    }
  } else {
    parts.push(`H:${input.html || ""}`);
    parts.push(`C:${input.css || ""}`);
    parts.push(`R:${input.react_code || ""}`);
  }

  if (input.plan) parts.push(`P:${JSON.stringify(input.plan)}`);
  if (input.databaseTables) parts.push(`DB:${[...input.databaseTables].sort().join(",")}`);
  if (input.deploymentStatuses) parts.push(`D:${[...input.deploymentStatuses].sort().join(",")}`);

  return sha256Hex(parts.join(""));
}
