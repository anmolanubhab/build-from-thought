// path: src/components/documentation/OutdatedBanner.tsx
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  busy: boolean;
  hasManualEdits: boolean;
  onRegenerate: () => void;
  onMerge: () => void;
  onKeepManual: () => void;
}

/** Auto Sync surface: shown on a section whose project fingerprint has
 *  drifted from the one it was last generated against. */
export default function OutdatedBanner({ busy, hasManualEdits, onRegenerate, onMerge, onKeepManual }: Props) {
  return (
    <div
      className="px-4 py-2.5 flex items-center gap-3 border-b text-xs"
      style={{ background: "rgba(245, 158, 11, 0.12)", borderColor: "rgba(245, 158, 11, 0.35)" }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#F59E0B" }} />
      <p className="flex-1" style={{ color: "var(--wb-text)" }}>
        The project has changed since this document was generated — it may be out of date.
      </p>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onKeepManual}
          disabled={busy}
          className="px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-60"
          style={{ color: "var(--wb-text-muted)" }}
        >
          Keep manual changes
        </button>
        {hasManualEdits && (
          <button
            onClick={onMerge}
            disabled={busy}
            className="px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-60"
            style={{ background: "var(--wb-surface-raised)", color: "var(--wb-text)" }}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Merge AI changes"}
          </button>
        )}
        <button
          onClick={onRegenerate}
          disabled={busy}
          className="px-2.5 py-1 rounded-md font-semibold text-white transition-colors disabled:opacity-60"
          style={{ background: "#F59E0B" }}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Regenerate section"}
        </button>
      </div>
    </div>
  );
}
