// path: src/components/editor/ProjectTopNav.tsx
import { Eye, Code2, BookOpenText, Rocket, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectTab = "preview" | "code" | "documentation" | "deploy" | "settings";

const TABS: { id: ProjectTab; label: string; icon: typeof Eye }[] = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "code", label: "Code", icon: Code2 },
  { id: "documentation", label: "Documentation", icon: BookOpenText },
  { id: "deploy", label: "Deploy", icon: Rocket },
  { id: "settings", label: "Settings", icon: Settings },
];

interface Props {
  active: ProjectTab;
  onChange: (tab: ProjectTab) => void;
  outdatedDocs?: boolean;
}

export default function ProjectTopNav({ active, onChange, outdatedDocs }: Props) {
  return (
    <div className="h-9 px-2 border-b border-gray-200 bg-white flex items-center gap-0.5 flex-shrink-0 overflow-x-auto">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            "relative flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
            active === id ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
          {id === "documentation" && outdatedDocs && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 absolute top-1 right-1.5" title="Documentation is outdated" />
          )}
        </button>
      ))}
    </div>
  );
}
