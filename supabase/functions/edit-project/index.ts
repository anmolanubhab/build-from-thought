import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, currentHtml, currentCss, currentReactCode, mode } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const applyMode = mode === "suggest" ? "suggestion" : "direct";

    const systemPrompt = `You are an expert web developer AI assistant. You are editing an existing web project.

Current project code:
--- HTML ---
${currentHtml || "<div></div>"}
--- CSS ---
${currentCss || ""}
--- React Code ---
${currentReactCode || ""}

The user wants to make changes. ${applyMode === "suggestion" ? "Provide a description of what you would change, then the updated code." : "Apply the changes directly."}

You MUST respond with valid JSON only, no markdown, no explanation. The JSON must have this exact structure:
{
  "summary": "Brief description of changes made",
  "html": "Updated complete HTML content (body inner HTML only)",
  "css": "Updated complete CSS styles",
  "react_code": "Updated complete React component code",
  "changes": ["List of specific changes made"]
}

Rules:
- Preserve existing functionality unless explicitly asked to change it
- Make the requested modifications cleanly
- Keep the design professional and responsive
- Do NOT include script tags in HTML
- Do NOT include import statements in HTML
- Return the FULL updated code, not just the diff`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt.trim() },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        const braceStart = content.indexOf("{");
        const braceEnd = content.lastIndexOf("}");
        if (braceStart !== -1 && braceEnd !== -1) {
          parsed = JSON.parse(content.substring(braceStart, braceEnd + 1));
        } else {
          throw new Error("Could not parse AI response as JSON");
        }
      }
    }

    const result = {
      summary: parsed.summary || "Changes applied",
      html: parsed.html || currentHtml,
      css: parsed.css || currentCss,
      react_code: parsed.react_code || currentReactCode,
      changes: parsed.changes || ["Code updated"],
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("edit-project error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
