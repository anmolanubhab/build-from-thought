// path: src/components/documentation/DocSearchCommand.tsx
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getSectionMeta } from "@/lib/documentation/registry";
import type { DocumentationSection, DocSectionKey } from "@/lib/documentation/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: DocumentationSection[];
  onSelect: (key: DocSectionKey) => void;
}

export default function DocSearchCommand({ open, onOpenChange, sections, onSelect }: Props) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search documentation…" />
      <CommandList>
        <CommandEmpty>No matching documentation found.</CommandEmpty>
        <CommandGroup heading="Sections">
          {sections
            .filter((s) => s.content_md?.trim())
            .map((s) => {
              const meta = getSectionMeta(s.section_key);
              return (
                <CommandItem
                  key={s.id}
                  value={`${meta.label} ${s.content_md}`}
                  onSelect={() => {
                    onSelect(s.section_key);
                    onOpenChange(false);
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {s.content_md.replace(/[#*`_>-]/g, "").trim().slice(0, 120)}
                  </span>
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
