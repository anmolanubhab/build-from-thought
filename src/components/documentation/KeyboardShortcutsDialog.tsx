// path: src/components/documentation/KeyboardShortcutsDialog.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "⌘ / Ctrl + K", action: "Search documentation" },
  { keys: "⌘ / Ctrl + S", action: "Save current section" },
  { keys: "⌘ / Ctrl + E", action: "Toggle edit / preview" },
  { keys: "⌘ / Ctrl + B", action: "Bold selection" },
  { keys: "⌘ / Ctrl + I", action: "Italic selection" },
  { keys: "⌘ / Ctrl + Shift + H", action: "Version history" },
  { keys: "?", action: "Show this shortcuts panel" },
];

export default function KeyboardShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" style={{ background: "var(--wb-surface)", borderColor: "var(--wb-line)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--wb-text)" }}>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between text-sm">
              <span style={{ color: "var(--wb-text-muted)" }}>{s.action}</span>
              <kbd className="text-[11px] px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--wb-line)", color: "var(--wb-text)" }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
