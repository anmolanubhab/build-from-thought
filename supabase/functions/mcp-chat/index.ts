// path: supabase/functions/mcp-chat/index.ts
// The isolated "AI Tool Planner" proof surface: given a user message, builds
// tool schemas from the workspace's connected + permitted MCP tools, runs a
// bounded tool-call loop against Gemini (primary) or Anthropic (fallback —
// only if Gemini fails before any tool call happens; switching providers
// mid-loop isn't attempted, since translating tool-call history between
// their different formats is its own can of worms), and returns the final
// answer plus a trace of which tools ran. Deliberately NOT wired into
// generate-app — this is a separate, low-risk surface to prove the loop.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";
import { executeToolAndLog, ExecuteError } from "../_shared/mcp/execute.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_MODEL = "claude-opus-4-8";
const MAX_TOOL_STEPS = 5;
const WALL_CLOCK_BUDGET_MS = 30_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface ToolBinding {
  llmName: string;
  connectionId: string;
  connectionName: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Gemini/Anthropic tool names must be simple identifiers — namespace by connection so same-named tools across servers don't collide. */
function toLlmName(connectionName: string, toolName: string, index: number): string {
  const slug = `${connectionName}_${toolName}`.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 50);
  return `${slug}_${index}`;
}

interface ToolTraceEntry {
  tool_name: string;
  connection_name: string;
  status: "ok" | "error";
  summary?: string;
}

async function runToolCall(
  admin: SupabaseClient,
  binding: ToolBinding,
  args: Record<string, unknown>,
  ctx: { workspaceId: string; invokedBy: string; role: "owner" | "editor" },
  trace: ToolTraceEntry[],
): Promise<unknown> {
  try {
    const result = await executeToolAndLog(admin, {
      connectionId: binding.connectionId,
      toolName: binding.toolName,
      args,
      workspaceId: ctx.workspaceId,
      invokedBy: ctx.invokedBy,
      role: ctx.role,
    });
    trace.push({ tool_name: binding.toolName, connection_name: binding.connectionName, status: "ok" });
    return result;
  } catch (err) {
    const message = err instanceof ExecuteError ? err.message : err instanceof Error ? err.message : "Tool failed";
    trace.push({ tool_name: binding.toolName, connection_name: binding.connectionName, status: "error", summary: message });
    return { error: message };
  }
}

const GEMINI_FETCH_TIMEOUT_MS = 25_000;

/**
 * Real MCP servers return arbitrary JSON Schema (anyOf/oneOf/$ref/etc.) —
 * Gemini's functionDeclarations.parameters only accepts a constrained
 * OpenAPI-3.0-like subset. Unions get collapsed to their first branch
 * (Gemini can't express "string or array of strings"); everything else is
 * passed through structurally. Anthropic's input_schema is closer to full
 * JSON Schema and doesn't need this.
 */
function sanitizeSchemaForGemini(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return { type: "string" };
  const s = schema as Record<string, unknown>;

  const union = (s.anyOf ?? s.oneOf ?? s.allOf) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(union) && union.length > 0) {
    const collapsed = sanitizeSchemaForGemini(union[0]);
    if (typeof s.description === "string" && !collapsed.description) collapsed.description = s.description;
    return collapsed;
  }

  const type = typeof s.type === "string" ? s.type : "string";
  const out: Record<string, unknown> = { type };
  if (typeof s.description === "string") out.description = s.description;
  if (Array.isArray(s.enum)) out.enum = s.enum;

  if (type === "object" && s.properties && typeof s.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(s.properties as Record<string, unknown>)) {
      props[key] = sanitizeSchemaForGemini(value);
    }
    out.properties = props;
    if (Array.isArray(s.required)) out.required = s.required;
  }

  if (type === "array" && s.items) out.items = sanitizeSchemaForGemini(s.items);

  return out;
}

async function runGeminiLoop(
  apiKey: string,
  message: string,
  bindings: ToolBinding[],
  admin: SupabaseClient,
  ctx: { workspaceId: string; invokedBy: string; role: "owner" | "editor" },
  trace: ToolTraceEntry[],
  deadline: number,
): Promise<string> {
  const functionDeclarations = bindings.map((b) => ({
    name: b.llmName,
    description: b.description,
    parameters: sanitizeSchemaForGemini(b.inputSchema),
  }));
  const contents: Array<{ role: string; parts: Record<string, unknown>[] }> = [{ role: "user", parts: [{ text: message }] }];

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    if (Date.now() > deadline) return "Ran out of time waiting on a tool — please try a narrower request.";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined,
          generationConfig: { temperature: 0.3 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Gemini API timed out after ${GEMINI_FETCH_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text().catch(() => "")}`);
    const data = await res.json();
    const parts: Array<Record<string, unknown>> = data.candidates?.[0]?.content?.parts ?? [];
    const functionCalls = parts.filter((p) => p.functionCall) as Array<{ functionCall: { name: string; args?: Record<string, unknown> } }>;

    if (functionCalls.length === 0) {
      const text = parts.map((p) => (p as { text?: string }).text ?? "").join("").trim();
      return text || "No response.";
    }

    contents.push({ role: "model", parts });
    const responseParts: Record<string, unknown>[] = [];
    for (const call of functionCalls) {
      const binding = bindings.find((b) => b.llmName === call.functionCall.name);
      const result = binding
        ? await runToolCall(admin, binding, call.functionCall.args ?? {}, ctx, trace)
        : { error: `Unknown tool: ${call.functionCall.name}` };
      responseParts.push({ functionResponse: { name: call.functionCall.name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }
  return "Reached the tool-call limit for this request without a final answer.";
}

async function runAnthropicLoop(
  apiKey: string,
  message: string,
  bindings: ToolBinding[],
  admin: SupabaseClient,
  ctx: { workspaceId: string; invokedBy: string; role: "owner" | "editor" },
  trace: ToolTraceEntry[],
  deadline: number,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const tools = bindings.map((b) => ({ name: b.llmName, description: b.description, input_schema: b.inputSchema as any }));
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    if (Date.now() > deadline) return "Ran out of time waiting on a tool — please try a narrower request.";

    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock && textBlock.type === "text" ? textBlock.text : "No response.";
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const binding = bindings.find((b) => b.llmName === block.name);
      const result = binding
        ? await runToolCall(admin, binding, (block.input as Record<string, unknown>) ?? {}, ctx, trace)
        : { error: `Unknown tool: ${block.name}` };
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }
    messages.push({ role: "user", content: toolResults });
  }
  return "Reached the tool-call limit for this request without a final answer.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const { workspace_id, message } = await req.json();
    if (!workspace_id || !message?.trim()) return json({ error: "workspace_id and message are required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: membership } = await admin
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) return json({ error: "Not a member of this workspace" }, 403);
    const role = membership.role as "owner" | "editor";

    const { data: connections } = await admin
      .from("mcp_connections")
      .select("id, name")
      .eq("workspace_id", workspace_id)
      .eq("status", "connected");
    const connectionIds = (connections ?? []).map((c) => c.id);

    let permittedConnectionIds = new Set(connectionIds);
    if (role !== "owner" && connectionIds.length > 0) {
      const { data: perms } = await admin
        .from("mcp_permissions")
        .select("connection_id, can_execute")
        .in("connection_id", connectionIds)
        .eq("role", role);
      permittedConnectionIds = new Set((perms ?? []).filter((p) => p.can_execute).map((p) => p.connection_id));
    }

    const { data: toolRows } = connectionIds.length > 0
      ? await admin.from("mcp_tools").select("connection_id, name, description, input_schema").in("connection_id", connectionIds).eq("is_stale", false)
      : { data: [] as Array<{ connection_id: string; name: string; description: string | null; input_schema: Record<string, unknown> }> };

    const connectionNameById = new Map((connections ?? []).map((c) => [c.id, c.name]));
    const bindings: ToolBinding[] = (toolRows ?? [])
      .filter((t) => permittedConnectionIds.has(t.connection_id))
      .map((t, i) => ({
        llmName: toLlmName(connectionNameById.get(t.connection_id) ?? "server", t.name, i),
        connectionId: t.connection_id,
        connectionName: connectionNameById.get(t.connection_id) ?? "Unknown",
        toolName: t.name,
        description: t.description ?? "",
        inputSchema: (t.input_schema && Object.keys(t.input_schema).length > 0 ? t.input_schema : { type: "object", properties: {} }),
      }));

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!geminiKey && !anthropicKey) return json({ error: "No AI provider is configured" }, 500);

    const trace: ToolTraceEntry[] = [];
    const ctx = { workspaceId: workspace_id as string, invokedBy: userId, role };
    const deadline = Date.now() + WALL_CLOCK_BUDGET_MS;

    let answer: string;
    try {
      if (!geminiKey) throw new Error("Gemini not configured");
      answer = await runGeminiLoop(geminiKey, message, bindings, admin, ctx, trace, deadline);
    } catch (geminiErr) {
      if (!anthropicKey) {
        const msg = geminiErr instanceof Error ? geminiErr.message : "Gemini failed";
        return json({ error: msg }, 502);
      }
      if (trace.length > 0) {
        // A tool already ran under Gemini's context — switching providers mid-loop
        // would need history translated between two different tool-call formats.
        return json({ error: "The AI provider failed partway through using a tool. Please try again." }, 502);
      }
      answer = await runAnthropicLoop(anthropicKey, message, bindings, admin, ctx, trace, deadline);
    }

    return json({ answer, trace });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
