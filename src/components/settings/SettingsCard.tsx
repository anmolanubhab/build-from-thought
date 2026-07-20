// path: src/components/settings/SettingsCard.tsx
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

export default function SettingsCard({ children, className = "" }: Props) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-6 ${className}`}>{children}</div>
  );
}

export function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0 border-b border-gray-100 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
