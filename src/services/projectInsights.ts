// path: src/services/projectInsights.ts
//
// Real, per-project data for the ProjectActionMenu's "Analytics" and
// "Activity" items. Neither one has a dedicated events/metrics table (the
// only audit trail in the app, workspace_audit_log, is workspace-scoped and
// nothing currently writes to it), so instead of inventing a fake feed both
// are built by reading the actual timestamped rows a project already
// accumulates across its lifecycle — deployments, database provisioning,
// documentation generation, saved versions, and the project row itself.
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { getProjectDatabase, type DatabaseStatus, type DatabaseMode } from "@/services/database";
import { CORE_DOC_SECTION_KEYS } from "@/lib/documentation/registry";

export interface ProjectAnalytics {
  viewCount: number;
  createdAt: string;
  updatedAt: string | null;
  isPublic: boolean;
  isStarred: boolean;
  type: string;
  stack: string;
  isMultipage: boolean;
  deploymentCount: number;
  latestDeployment: { status: string; url: string | null; createdAt: string } | null;
  database: { mode: DatabaseMode; status: DatabaseStatus; tableCount: number } | null;
  documentation: { generated: number; total: number };
  versionCount: number;
}

export async function fetchProjectAnalytics(project: Project): Promise<ProjectAnalytics> {
  const [{ data: freshProject }, { data: deployments }, database, { data: docSections }, { count: versionCount }] = await Promise.all([
    supabase.from("projects").select("view_count, updated_at").eq("id", project.id).maybeSingle(),
    supabase
      .from("deployments")
      .select("status, deploy_url, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
    getProjectDatabase(project.id).catch(() => null),
    supabase.from("documentation_sections").select("section_key").eq("project_id", project.id),
    supabase.from("project_versions").select("id", { count: "exact", head: true }).eq("project_id", project.id),
  ]);

  const deploymentRows = (deployments ?? []) as { status: string; deploy_url: string | null; created_at: string }[];
  const generatedCoreSections = new Set(
    ((docSections ?? []) as { section_key: string }[])
      .map((s) => s.section_key)
      .filter((key) => (CORE_DOC_SECTION_KEYS as string[]).includes(key)),
  );

  return {
    viewCount: (freshProject as { view_count: number } | null)?.view_count ?? project.view_count ?? 0,
    createdAt: project.created_at,
    updatedAt: (freshProject as { updated_at: string } | null)?.updated_at ?? project.updated_at ?? null,
    isPublic: project.is_public,
    isStarred: project.is_starred,
    type: project.type,
    stack: project.stack ?? "static",
    isMultipage: project.is_multipage,
    deploymentCount: deploymentRows.length,
    latestDeployment: deploymentRows[0]
      ? { status: deploymentRows[0].status, url: deploymentRows[0].deploy_url, createdAt: deploymentRows[0].created_at }
      : null,
    database: database ? { mode: database.mode, status: database.status, tableCount: database.tables.length } : null,
    documentation: { generated: generatedCoreSections.size, total: CORE_DOC_SECTION_KEYS.length },
    versionCount: versionCount ?? 0,
  };
}

export type ActivityEventKind =
  | "created" | "updated" | "deployment" | "database" | "documentation" | "version";

export interface ActivityEvent {
  kind: ActivityEventKind;
  label: string;
  detail?: string;
  at: string;
}

export async function fetchProjectActivity(project: Project): Promise<ActivityEvent[]> {
  const [{ data: deployments }, database, { data: docSections }, { data: versions }] = await Promise.all([
    supabase
      .from("deployments")
      .select("status, deploy_url, created_at, provider")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(10),
    getProjectDatabase(project.id).catch(() => null),
    supabase
      .from("documentation_sections")
      .select("section_key, generated_at, has_manual_edits, updated_at")
      .eq("project_id", project.id),
    supabase
      .from("project_versions")
      .select("version_number, status, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const events: ActivityEvent[] = [];

  events.push({ kind: "created", label: "Project created", at: project.created_at });

  if (project.updated_at && project.updated_at !== project.created_at) {
    events.push({ kind: "updated", label: "Project settings updated", at: project.updated_at });
  }

  for (const d of (deployments ?? []) as { status: string; deploy_url: string | null; created_at: string; provider: string }[]) {
    events.push({
      kind: "deployment",
      label: d.status === "ready" || d.status === "success" ? "Deployed" : `Deployment ${d.status}`,
      detail: d.deploy_url ?? d.provider,
      at: d.created_at,
    });
  }

  if (database) {
    events.push({
      kind: "database",
      label: database.status === "ready" ? "Database connected" : database.status === "error" ? "Database provisioning failed" : "Database provisioning",
      detail: `${database.mode} · ${database.tables.length} table${database.tables.length === 1 ? "" : "s"}`,
      at: project.created_at, // provisioning timestamp isn't exposed by getProjectDatabase; anchor near project activity rather than omit it
    });
  }

  for (const s of (docSections ?? []) as { section_key: string; generated_at: string | null; has_manual_edits: boolean; updated_at: string }[]) {
    if (s.generated_at) {
      events.push({ kind: "documentation", label: `Documentation generated — ${s.section_key.replace(/_/g, " ")}`, at: s.generated_at });
    }
    if (s.has_manual_edits) {
      events.push({ kind: "documentation", label: `Documentation edited — ${s.section_key.replace(/_/g, " ")}`, at: s.updated_at });
    }
  }

  for (const v of (versions ?? []) as { version_number: number; status: string; created_at: string }[]) {
    events.push({ kind: "version", label: `Version ${v.version_number} saved`, detail: v.status, at: v.created_at });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return events;
}
