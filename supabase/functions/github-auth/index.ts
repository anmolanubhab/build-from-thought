const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientId = Deno.env.get("GITHUB_CLIENT_ID");
  if (!clientId) {
    return new Response(JSON.stringify({ error: "GitHub not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(req.url);
  const redirectUri = searchParams.get("redirect_uri") || "";

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", clientId);
  githubUrl.searchParams.set("redirect_uri", redirectUri);
  githubUrl.searchParams.set("scope", "repo");

  return new Response(JSON.stringify({ url: githubUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
