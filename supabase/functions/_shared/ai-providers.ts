// path: supabase/functions/_shared/ai-providers.ts
//
// Shared Gemini(primary) + Claude(fallback) JSON-generation helper, factored
// out of edit-project/index.ts so new agents (like generate-documentation)
// don't have to re-implement the same fallback/parsing logic.

import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const ANTHROPIC_MODEL = "claude-opus-4-8";

// Bounds a single Gemini call so a hung upstream request can never quietly
// exhaust the caller's own Edge Function execution budget — a timeout
// surfaces as a clean, retryable error instead of a platform-level hang.
// Callers (e.g. generate-documentation) retry the whole section on this,
// same as any other transient failure.
const GEMINI_TIMEOUT_MS = 25_000;

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function generateWithGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderError(`Gemini API timed out after ${GEMINI_TIMEOUT_MS}ms`, 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const text = await response.text();
    console.error("Gemini API error:", response.status, text);
    throw new ProviderError(`Gemini API error: ${response.status}`, response.status);
  }
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("No content in Gemini response");
  return content;
}

async function generateWithClaude(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No content in Claude response");
  return textBlock.text;
}

export function parseJSON(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    const braceStart = content.indexOf("{");
    const braceEnd = content.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd !== -1) {
      return JSON.parse(content.substring(braceStart, braceEnd + 1));
    }
    throw new Error("Could not parse AI response as JSON");
  }
}

/** Gemini primary, Claude fallback (if configured). Returns parsed JSON. */
export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
  geminiKey: string,
  anthropicKey: string | undefined,
): Promise<any> {
  try {
    return parseJSON(await generateWithGemini(geminiKey, systemPrompt, userPrompt));
  } catch (geminiErr) {
    const geminiMessage = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
    if (!anthropicKey) throw geminiErr;
    console.error(`Gemini failed (${geminiMessage}) — falling back to Claude`);
    try {
      return parseJSON(await generateWithClaude(anthropicKey, systemPrompt, userPrompt));
    } catch (claudeErr) {
      const claudeMessage = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
      const status = geminiErr instanceof ProviderError && geminiErr.status === 429 ? 429 : 502;
      throw new ProviderError(
        `Gemini failed (${geminiMessage}) and Claude fallback also failed (${claudeMessage})`,
        status,
      );
    }
  }
}
