import { useState } from "react";
import { Project } from "@/lib/projects";
import ProjectCard from "./ProjectCard";
import { ArrowRight, Plus } from "lucide-react";

interface ProjectsSectionProps {
  projects: Project[];
  loading: boolean;
  onOpen: (p: Project) => void;
  onDelete: (id: string) => void;
}

const tabs = ["My projects", "Recently viewed", "Starred", "Templates"];

export default function ProjectsSection({ projects, loading, onOpen, onDelete }: ProjectsSectionProps) {
  const [activeTab, setActiveTab] = useState("My projects");

  const filteredProjects = activeTab === "Starred"
    ? projects.filter((p) => p.is_public)
    : projects;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-3xl mx-4 md:mx-6 -mt-8 relative z-10 shadow-sm border border-gray-100">
      <div className="p-5 md:p-6">
        {/* Tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1 text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors">
            Browse all <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl h-64 bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-semibold mb-1">No projects yet</h3>
            <p className="text-sm text-gray-500">Describe your idea above and let AI build it for you</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
