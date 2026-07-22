// path: src/components/documentation/GenerateButton.tsx
import { useState } from "react";
import { Sparkles, ChevronDown, Loader2, Users, GraduationCap } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { DocSectionKey, ExplainAudience, GenerationMode } from "@/lib/documentation/types";

interface Props {
  sectionKey: DocSectionKey;
  hasContent: boolean;
  hasManualEdits: boolean;
  generating: boolean;
  onGenerate: (mode: GenerationMode, extra?: { audience?: ExplainAudience }) => void;
}

/** Button surface for the "AI Documentation Generator" — data-driven per
 *  section-key quirks (ai_explain needs an audience, everything else is a
 *  plain generate/regenerate/merge trio) rather than a hardcoded switch
 *  spread across the workspace. */
export default function GenerateButton({ sectionKey, hasContent, hasManualEdits, generating, onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const label = sectionKey === "viva_mode" ? "Viva Questions" : sectionKey === "ai_explain" ? "Explanation" : "Documentation";

  const btnClass = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60";
  const btnStyle = { background: "var(--wb-circuit)" };

  if (sectionKey === "ai_explain") {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button className={btnClass} style={btnStyle} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {hasContent ? "Regenerate" : "Explain This Project"} <ChevronDown className="h-3 w-3 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onGenerate("generate", { audience: "client" })} className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" /> For client presentation
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onGenerate("generate", { audience: "viva" })} className="gap-2 text-xs">
            <GraduationCap className="h-3.5 w-3.5" /> For college viva
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (!hasContent) {
    return (
      <button className={btnClass} style={btnStyle} disabled={generating} onClick={() => onGenerate("generate")}>
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Generate {label}
      </button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className={btnClass} style={btnStyle} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Regenerate <ChevronDown className="h-3 w-3 opacity-80" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onGenerate("regenerate")} className="gap-2 text-xs">
          <Sparkles className="h-3.5 w-3.5" /> Regenerate section (overwrite)
        </DropdownMenuItem>
        {hasManualEdits && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onGenerate("merge")} className="gap-2 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Merge AI changes (keep your edits)
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
