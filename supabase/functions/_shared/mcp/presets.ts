// path: supabase/functions/_shared/mcp/presets.ts
// Known, verified-reachable hosted MCP servers. "Custom" connections (no
// preset) are handled separately by mcp-connect — any URL + bearer token.

export type McpAuthKind = "bearer" | "url_key" | "reuse_github_token";

export interface McpPreset {
  slug: string;
  endpointTemplate: string;
  authKind: McpAuthKind;
}

export const MCP_PRESETS: Record<string, McpPreset> = {
  github: { slug: "github", endpointTemplate: "https://api.githubcopilot.com/mcp/", authKind: "reuse_github_token" },
  stripe: { slug: "stripe", endpointTemplate: "https://mcp.stripe.com", authKind: "bearer" },
  firecrawl: { slug: "firecrawl", endpointTemplate: "https://mcp.firecrawl.dev/{API_KEY}/v2/mcp", authKind: "url_key" },
};

/** Resolves a preset's real endpoint URL, substituting a URL-templated API key if the preset needs one. */
export function resolvePresetEndpointUrl(preset: McpPreset, apiKey?: string): string {
  if (preset.authKind === "url_key") {
    if (!apiKey) throw new Error(`${preset.slug} requires an API key`);
    return preset.endpointTemplate.replace("{API_KEY}", encodeURIComponent(apiKey));
  }
  return preset.endpointTemplate;
}
