// path: src/components/settings/ComingSoonSection.tsx
import type { LucideIcon } from "lucide-react";
import { Clock } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function ComingSoonSection({ icon: Icon, title, description }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 p-10 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <h3 className="font-display text-base font-bold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-3">{description}</p>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
        <Clock className="h-3 w-3" /> Coming soon
      </span>
    </div>
  );
}
