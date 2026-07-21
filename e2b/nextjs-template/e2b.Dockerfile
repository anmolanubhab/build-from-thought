# path: e2b/nextjs-template/e2b.Dockerfile
#
# Optional performance upgrade for WebdevsAI's live preview runtime.
#
# preview-start (supabase/functions/preview-start/index.ts) works today against
# E2B's stock "code-interpreter-v1" template — it writes the generated project's
# files into a fresh sandbox and runs `npm install` from scratch every time. That
# works, but a cold `npm install` for Next 15 + React 19 + Tailwind v4 typically
# takes 20-40s before the dev server can even start.
#
# This custom template pre-bakes node_modules for WebdevsAI's FIXED base
# dependency set (the same set every generated project starts with — see
# supabase/functions/generate-app/scaffold.ts's packageJson()) directly into the
# sandbox image. When a real project's package.json is written on top of this at
# preview time, `npm install` only has to fetch whatever EXTRA packages that
# specific project's AI generation actually chose from DEPENDENCY_ALLOWLIST —
# usually zero or a handful — instead of the entire dependency tree. That's the
# entire point: faster cold starts, nothing else changes about how the preview
# behaves.
#
# This is NOT required for the live preview to work — it's a follow-on
# optimization. Skip this whole file until the base pipeline (preview-start /
# -status / -sync / -stop / -sweep) is confirmed working against the stock
# template in production.
#
# --- How to build and deploy this (you must do this yourself — it requires an
# E2B account and API key, which I cannot create on your behalf) ---
#
#   1. npm install -g @e2b/cli
#   2. e2b auth login
#   3. cd e2b/nextjs-template
#   4. e2b template build --name webdevsai-nextjs --dockerfile e2b.Dockerfile \
#        --cpu-count 2 --memory-mb 2048
#   5. Copy the template ID it prints (should be "webdevsai-nextjs") and set it
#      as the E2B_TEMPLATE_ID secret on the Supabase project:
#        supabase secrets set E2B_TEMPLATE_ID=webdevsai-nextjs
#      preview-start already reads this secret automatically
#      (Deno.env.get("E2B_TEMPLATE_ID") || "code-interpreter-v1") — no code
#      change needed once it's set.
#   6. Re-run this build after ANY change to scaffold.ts's fixed dependency
#      versions, so the pre-baked node_modules doesn't drift from what
#      generated projects actually declare.

FROM node:22-slim

# curl is used by preview-start's waitForServer() to poll the dev server from
# inside the sandbox; git is occasionally needed by npm for git-hosted deps.
RUN apt-get update && apt-get install -y --no-install-recommends curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/user/project

# Mirrors packageJson() in supabase/functions/generate-app/scaffold.ts exactly.
# Keep this in sync by hand whenever that function's base dependency/devDependency
# versions change — there's no build-time way to import a Deno edge function's
# TypeScript module into this Dockerfile, so this is intentionally a plain copy.
COPY package.json ./

# Pre-bake node_modules for the fixed base set. --no-audit/--no-fund match the
# flags preview-start itself uses, so the cache this produces is bit-for-bit
# what a fresh `npm install` would produce for a project that adds no extra
# packages.
RUN npm install --no-audit --no-fund

# Every generated project's real files (page.tsx, components, package.json with
# any extra allow-listed deps, etc.) get written on top of this directory by
# preview-start at request time — this template only ever ships the
# pre-installed node_modules and the base package.json above, never any
# app-specific code.
