// path: supabase/functions/provision-database/validator.ts
// Deterministic project validation (QA Agent pre-pass) for modern Next.js file maps.
// Pure code — no AI. Catches unresolved imports, missing "use client" directives,
// broken route links, and keeps package.json dependencies in sync automatically.
//
// NOTE: an identical copy lives in supabase/functions/generate-app/validator.ts, supabase/functions/edit-project/validator.ts, and supabase/functions/check-database-provisioning/validator.ts —
// keep both in sync when editing.

export interface ValidationIssue {
  file: string;
  issue: string;
}

export interface ValidationResult {
  /** Issues that need an AI fix (deterministic fixes are already applied to `files`). */
  issues: ValidationIssue[];
  /** File map with deterministic fixes (dependency sync) applied. */
  files: Record<string, string>;
  /** Human-readable log of deterministic fixes applied. */
  autoFixes: string[];
}

/** Packages generated projects may use (must match the scaffold allowlist). */
const ALLOWLIST: Record<string, string> = {
  "framer-motion": "^12.0.0",
  "recharts": "^2.15.0",
  "react-hook-form": "^7.54.0",
  "zod": "^3.24.0",
  "@hookform/resolvers": "^3.10.0",
  "date-fns": "^4.1.0",
  "sonner": "^2.0.0",
  "cmdk": "^1.0.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "@radix-ui/react-dropdown-menu": "^2.1.0",
  "@radix-ui/react-tabs": "^1.1.0",
  "@radix-ui/react-select": "^2.1.0",
  "@radix-ui/react-switch": "^1.1.0",
  "@radix-ui/react-avatar": "^1.1.0",
  "@radix-ui/react-tooltip": "^1.1.0",
  "@radix-ui/react-accordion": "^1.2.0",
  "@radix-ui/react-checkbox": "^1.1.0",
  "@radix-ui/react-label": "^2.1.0",
  "@radix-ui/react-popover": "^1.1.0",
  "@radix-ui/react-progress": "^1.1.0",
  "@radix-ui/react-slider": "^1.2.0",
  "@supabase/supabase-js": "^2.49.0",
};

/** Packages always present in the scaffold — never flagged, never removed. */
const BASE_PACKAGES = new Set([
  "next", "react", "react-dom", "clsx", "tailwind-merge",
  "class-variance-authority", "lucide-react",
]);

const CODE_EXT = /\.(ts|tsx)$/;
const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".css", "/index.ts", "/index.tsx"];

function resolvePath(files: Record<string, string>, base: string): string | null {
  for (const suffix of RESOLVE_SUFFIXES) {
    if (files[base + suffix] !== undefined) return base + suffix;
  }
  return null;
}

function normalizeRelative(fromFile: string, spec: string): string {
  const dir = fromFile.split("/").slice(0, -1);
  const parts = spec.split("/");
  const stack = [...dir];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function packageNameOf(spec: string): string {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const CLIENT_SIGNALS =
  /\buse(State|Effect|Ref|Callback|Memo|Reducer|LayoutEffect|Transition|Optimistic|ActionState)\s*\(|\bon(Click|Change|Submit|Input|KeyDown|KeyUp|MouseEnter|MouseLeave|Focus|Blur|Scroll)\s*=\{/;
const CLIENT_ONLY_PACKAGES = ["framer-motion", "recharts", "sonner", "cmdk"];

function hasUseClientDirective(content: string): boolean {
  return /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(content);
}

/**
 * Validates a modern project file map. Applies deterministic fixes
 * (dependency sync in package.json) directly; returns remaining issues
 * that need an AI (QA agent) fix.
 */
export function validateProject(inputFiles: Record<string, string>): ValidationResult {
  const files = { ...inputFiles };
  const issues: ValidationIssue[] = [];
  const autoFixes: string[] = [];
  const usedPackages = new Set<string>();

  // --- Required entry files ---
  if (!files["app/page.tsx"]) issues.push({ file: "app/page.tsx", issue: "Missing required file app/page.tsx" });
  if (!files["app/layout.tsx"]) issues.push({ file: "app/layout.tsx", issue: "Missing required file app/layout.tsx" });

  const importRe = /(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

  for (const [path, content] of Object.entries(files)) {
    if (!CODE_EXT.test(path)) continue;

    // --- Import resolution ---
    let m: RegExpExecArray | null;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(content)) !== null) {
      const spec = m[1] || m[2];
      if (!spec) continue;

      if (spec.startsWith("@/")) {
        if (!resolvePath(files, spec.slice(2))) {
          issues.push({ file: path, issue: `Unresolved import \"${spec}\" — the target file does not exist. Create it or fix the path.` });
        }
      } else if (spec.startsWith("./") || spec.startsWith("../")) {
        if (!resolvePath(files, normalizeRelative(path, spec))) {
          issues.push({ file: path, issue: `Unresolved relative import \"${spec}\" — the target file does not exist. Create it or fix the path.` });
        }
      } else {
        usedPackages.add(packageNameOf(spec));
      }
    }

    // --- "use client" heuristic ---
    const importsClientOnlyPkg = CLIENT_ONLY_PACKAGES.some((p) =>
      new RegExp(`from\\s+['\"]${p}(/|['\"])`).test(content)
    );
    if ((CLIENT_SIGNALS.test(content) || importsClientOnlyPkg) && !hasUseClientDirective(content)) {
      issues.push({
        file: path,
        issue: `Uses hooks/event handlers/client-only libraries but is missing the \"use client\" directive at the top of the file.`,
      });
    }
  }

  // --- Internal route link check ---
  const routeExists = (route: string): boolean => {
    const clean = route.replace(/^\/+|\/+$/g, "");
    if (clean === "") return files["app/page.tsx"] !== undefined;
    return files[`app/${clean}/page.tsx`] !== undefined;
  };
  const hrefRe = /href=["'](\/[a-zA-Z0-9\-_/]*)["']/g;
  for (const [path, content] of Object.entries(files)) {
    if (!CODE_EXT.test(path)) continue;
    let m: RegExpExecArray | null;
    hrefRe.lastIndex = 0;
    const flagged = new Set<string>();
    while ((m = hrefRe.exec(content)) !== null) {
      const route = m[1];
      if (route.includes("#") || flagged.has(route)) continue;
      if (!routeExists(route)) {
        flagged.add(route);
        issues.push({
          file: path,
          issue: `Links to internal route \"${route}\" but app${route}/page.tsx does not exist. Create the route or change the link.`,
        });
      }
    }
  }

  // --- Dependency sync (deterministic auto-fix on package.json) ---
  if (files["package.json"]) {
    try {
      const pkg = JSON.parse(files["package.json"]);
      const deps: Record<string, string> = pkg.dependencies || {};
      let changed = false;

      for (const used of usedPackages) {
        if (used.startsWith("next/") || BASE_PACKAGES.has(used) || used === "next") continue;
        if (deps[used]) continue;
        if (ALLOWLIST[used]) {
          deps[used] = ALLOWLIST[used];
          changed = true;
          autoFixes.push(`Added missing dependency ${used}`);
        } else {
          issues.push({
            file: "package.json",
            issue: `Code imports \"${used}\" which is not an available package. Rewrite the importing code to use available packages only (allowlist: ${Object.keys(ALLOWLIST).join(", ")}).`,
          });
        }
      }

      // Remove allowlisted extras that nothing imports (keep base deps always).
      for (const dep of Object.keys(deps)) {
        if (BASE_PACKAGES.has(dep)) continue;
        if (ALLOWLIST[dep] && !usedPackages.has(dep)) {
          delete deps[dep];
          changed = true;
          autoFixes.push(`Removed unused dependency ${dep}`);
        }
      }

      if (changed) {
        pkg.dependencies = deps;
        files["package.json"] = JSON.stringify(pkg, null, 2);
      }
    } catch {
      issues.push({ file: "package.json", issue: "package.json is not valid JSON." });
    }
  }

  return { issues, files, autoFixes };
}

/** Compact issue list for inclusion in a QA-agent prompt. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map((i, n) => `${n + 1}. [${i.file}] ${i.issue}`).join("\n");
}
