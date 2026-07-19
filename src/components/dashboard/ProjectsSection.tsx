// path: src/components/dashboard/ProjectsSection.tsx
import { useState } from "react";
import { Project } from "@/lib/projects";
import ProjectCard from "./ProjectCard";
import { ArrowRight, Plus } from "lucide-react";

interface ProjectsSectionProps {
  projects: Project[];
  loading: boolean;
  onOpen: (p: Project) => void;
  onDelete: (id: string) => void;
  onStarChange?: (p: Project) => void;
}

const tabs = ["My projects", "Recently viewed", "Starred", "Templates"];

export default function ProjectsSection({ projects, loading, onOpen, onDelete, onStarChange }: ProjectsSectionProps) {
  const [activeTab, setActiveTab] = useState("My projects");

  const filteredProjects = activeTab === "Starred"
    ? projects.filter((p) => p.is_starred)
    : projects;

  return (
    <div
      className="rounded-2xl mx-4 md:mx-6 -mt-8 relative z-10 border wb-sans"
      style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}
    >
      <div className="p-5 md:p-6">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="wb-mono px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wide font-medium transition-colors"
                style={{
                  background: activeTab === tab ? "var(--wb-ember)" : "transparent",
                  color: activeTab === tab ? "white" : "var(--wb-text-muted)",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            className="flex items-center gap-1 text-[13px] font-medium transition-colors hover:brightness-125"
            style={{ color: "var(--wb-text-muted)" }}
          >
            Browse all <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl h-56 animate-pulse" style={{ background: "var(--wb-surface-raised)" }} />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 text-center wb-blueprint-grid rounded-xl">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border"
              style={{ background: "var(--wb-surface-raised)", borderColor: "var(--wb-line)" }}
            >
              <Plus className="h-7 w-7" style={{ color: "var(--wb-circuit)" }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ color: "var(--wb-text)" }}>No projects yet</h3>
            <p className="text-sm" style={{ color: "var(--wb-text-muted)" }}>Describe your idea above and let AI build it for you</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={onOpen}
                onDelete={onDelete}
                onStarChange={onStarChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
