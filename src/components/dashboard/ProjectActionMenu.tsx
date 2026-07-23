// path: src/components/dashboard/ProjectActionMenu.tsx
//
// Reusable, self-contained project context menu — original design, built on
// shadcn/ui's Radix-backed DropdownMenu (keyboard nav, focus management, and
// open/close animations all come from Radix + tailwindcss-animate for free).
// Lovable's "..." card menu was used only as UX reference for which actions
// belong together; the grouping, icon set, destructive-delete treatment, and
// hover motion here are original.
//
// Not wired to any data layer on purpose — every action is an optional
// callback prop, so it drops in anywhere with just:
//
//   <ProjectActionMenu project={project} />
//
// and the consumer wires up only the actions it needs:
//
//   <ProjectActionMenu
//     project={project}
//     onRename={(p) => openRenameDialog(p)}
//     onDelete={(p) => confirmDelete(p)}
//   />
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  FolderOpen, ExternalLink, Smartphone, Pencil, FolderInput, Star, Pin, PinOff,
  GitFork, Copy, FileOutput, Archive, Share2, Link2, Rocket, BarChart3, Activity,
  Settings, Trash2, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/projects";

export interface ProjectActionMenuProps {
  project: Project;
  /** Defaults to project.is_starred when not provided. */
  isStarred?: boolean;
  /** Project has no `is_pinned` column yet — caller supplies this if it tracks pinning elsewhere. */
  isPinned?: boolean;
  /** Defaults to project.is_public when not provided. */
  isPublished?: boolean;
  /** Custom trigger element (rendered via `asChild`). Defaults to a "⋮" icon button. */
  trigger?: React.ReactNode;
  /** Accessible label for the default trigger button. */
  triggerLabel?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  contentClassName?: string;
  onOpenChange?: (open: boolean) => void;

  onOpen?: (project: Project) => void;
  onOpenLivePreview?: (project: Project) => void;
  onPreviewMobile?: (project: Project) => void;
  onRename?: (project: Project) => void;
  onMoveToFolder?: (project: Project) => void;
  onToggleStar?: (project: Project) => void;
  onTogglePin?: (project: Project) => void;
  onRemix?: (project: Project) => void;
  onDuplicate?: (project: Project) => void;
  onExport?: (project: Project) => void;
  onDownloadZip?: (project: Project) => void;
  onShare?: (project: Project) => void;
  onCopyLink?: (project: Project) => void;
  onTogglePublish?: (project: Project) => void;
  onAnalytics?: (project: Project) => void;
  onActivity?: (project: Project) => void;
  onSettings?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

interface ActionItemProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

function ActionItem({ icon: Icon, iconClassName, label, destructive, disabled, onSelect }: ActionItemProps) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => onSelect?.()}
      className={cn(
        "group gap-2.5 rounded-md px-2.5 py-2 text-[13px] leading-none",
        "cursor-pointer transition-colors duration-150",
        destructive
          ? "text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/40 dark:focus:text-red-300"
          : "text-foreground/90 focus:bg-accent focus:text-accent-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-transform duration-150 ease-out",
          "group-focus:translate-x-0.5 group-focus:scale-110",
          destructive ? "text-red-500 dark:text-red-400" : "text-muted-foreground group-focus:text-accent-foreground",
          iconClassName,
        )}
      />
      <span className="flex-1 truncate">{label}</span>
    </DropdownMenuItem>
  );
}

export function ProjectActionMenu({
  project,
  isStarred,
  isPinned = false,
  isPublished,
  trigger,
  triggerLabel = "Project actions",
  align = "end",
  side = "bottom",
  className,
  contentClassName,
  onOpenChange,
  onOpen,
  onOpenLivePreview,
  onPreviewMobile,
  onRename,
  onMoveToFolder,
  onToggleStar,
  onTogglePin,
  onRemix,
  onDuplicate,
  onExport,
  onDownloadZip,
  onShare,
  onCopyLink,
  onTogglePublish,
  onAnalytics,
  onActivity,
  onSettings,
  onDelete,
}: ProjectActionMenuProps) {
  const starred = isStarred ?? project.is_starred;
  const published = isPublished ?? project.is_public;

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            aria-label={triggerLabel}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground",
              "transition-all duration-150 hover:bg-accent hover:text-accent-foreground hover:scale-105",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              className,
            )}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={6}
        collisionPadding={8}
        avoidCollisions
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-60 max-w-[calc(100vw-1rem)] rounded-xl p-1.5 duration-200",
          "sm:w-64",
          // 18 items + 5 separators is taller than the viewport for cards near the
          // top/bottom of the page. Without this, Radix still renders the full list —
          // whatever doesn't fit just ends up off-screen (looks like items "disappear").
          // Capping to Radix's own available-space var + scrolling keeps every item
          // reachable no matter where the trigger sits.
          "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
          contentClassName,
        )}
      >
        <ActionItem icon={FolderOpen} label="Open Project" onSelect={() => onOpen?.(project)} />
        <ActionItem icon={ExternalLink} label="Open Live Preview" onSelect={() => onOpenLivePreview?.(project)} />
        <ActionItem icon={Smartphone} label="Preview Mobile" onSelect={() => onPreviewMobile?.(project)} />

        <DropdownMenuSeparator />

        <ActionItem icon={Pencil} label="Rename" onSelect={() => onRename?.(project)} />
        <ActionItem icon={FolderInput} label="Move to Folder" onSelect={() => onMoveToFolder?.(project)} />
        <ActionItem
          icon={Star}
          iconClassName={starred ? "fill-current text-amber-500 group-focus:text-amber-500" : undefined}
          label={starred ? "Unstar" : "Star"}
          onSelect={() => onToggleStar?.(project)}
        />
        <ActionItem
          icon={isPinned ? PinOff : Pin}
          label={isPinned ? "Unpin Project" : "Pin Project"}
          onSelect={() => onTogglePin?.(project)}
        />

        <DropdownMenuSeparator />

        <ActionItem icon={GitFork} label="Remix" onSelect={() => onRemix?.(project)} />
        <ActionItem icon={Copy} label="Duplicate" onSelect={() => onDuplicate?.(project)} />
        <ActionItem icon={FileOutput} label="Export" onSelect={() => onExport?.(project)} />
        <ActionItem icon={Archive} label="Download ZIP" onSelect={() => onDownloadZip?.(project)} />

        <DropdownMenuSeparator />

        <ActionItem icon={Share2} label="Share" onSelect={() => onShare?.(project)} />
        <ActionItem icon={Link2} label="Copy Link" onSelect={() => onCopyLink?.(project)} />
        <ActionItem
          icon={Rocket}
          iconClassName={published ? "text-emerald-500 group-focus:text-emerald-500" : undefined}
          label={published ? "Unpublish" : "Publish"}
          onSelect={() => onTogglePublish?.(project)}
        />

        <DropdownMenuSeparator />

        <ActionItem icon={BarChart3} label="Analytics" onSelect={() => onAnalytics?.(project)} />
        <ActionItem icon={Activity} label="Activity" onSelect={() => onActivity?.(project)} />
        <ActionItem icon={Settings} label="Settings" onSelect={() => onSettings?.(project)} />

        <DropdownMenuSeparator />

        <ActionItem icon={Trash2} label="Delete Project" destructive onSelect={() => onDelete?.(project)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ProjectActionMenu;
