import { ProjectType } from "@/lib/projects";
import { BarChart3, User, Layout, Globe, Code, Image, Star, Mail } from "lucide-react";

interface Props {
  type: ProjectType;
  className?: string;
}

const PortfolioPreview = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
        <User className="h-5 w-5 text-primary" />
      </div>
      <div>
        <div className="h-3 w-24 rounded bg-foreground/20" />
        <div className="h-2 w-16 rounded bg-muted-foreground/20 mt-1" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[Image, Code, Globe, Star].map((Icon, i) => (
        <div key={i} className="rounded-lg bg-secondary/60 p-3 flex flex-col items-center gap-1">
          <Icon className="h-4 w-4 text-primary/60" />
          <div className="h-2 w-12 rounded bg-muted-foreground/15" />
        </div>
      ))}
    </div>
    <div className="h-16 rounded-lg bg-secondary/40 p-2 space-y-1">
      <div className="h-2 w-full rounded bg-muted-foreground/15" />
      <div className="h-2 w-3/4 rounded bg-muted-foreground/15" />
      <div className="h-2 w-1/2 rounded bg-muted-foreground/15" />
    </div>
  </div>
);

const DashboardPreview = () => (
  <div className="flex gap-2 h-full">
    <div className="w-16 rounded-lg bg-secondary/60 p-2 space-y-2 flex-shrink-0">
      <div className="h-2 w-full rounded bg-muted-foreground/20" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-2 w-full rounded bg-muted-foreground/10" />
      ))}
    </div>
    <div className="flex-1 space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {["Users", "Revenue", "Growth"].map(label => (
          <div key={label} className="rounded-lg bg-secondary/60 p-2 text-center">
            <div className="text-[8px] text-muted-foreground">{label}</div>
            <div className="h-3 w-8 mx-auto rounded bg-primary/30 mt-1" />
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-secondary/60 p-2 flex items-end gap-1 h-16">
        {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
          <div key={i} className="flex-1 rounded-sm bg-primary/40" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  </div>
);

const LandingPreview = () => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <div className="h-3 w-16 rounded bg-foreground/20" />
      <div className="flex gap-1">
        {[1, 2, 3].map(i => <div key={i} className="h-2 w-8 rounded bg-muted-foreground/15" />)}
      </div>
    </div>
    <div className="text-center py-4 space-y-2">
      <div className="h-4 w-32 mx-auto rounded bg-foreground/20" />
      <div className="h-2 w-40 mx-auto rounded bg-muted-foreground/15" />
      <div className="h-6 w-20 mx-auto rounded-md gradient-bg mt-2" />
    </div>
    <div className="grid grid-cols-3 gap-1.5">
      {[Layout, Globe, Mail].map((Icon, i) => (
        <div key={i} className="rounded-lg bg-secondary/60 p-2 flex flex-col items-center gap-1">
          <Icon className="h-3 w-3 text-primary/60" />
          <div className="h-1.5 w-10 rounded bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  </div>
);

const GenericPreview = () => (
  <div className="space-y-3">
    <div className="h-4 w-28 rounded bg-foreground/20" />
    <div className="space-y-1.5">
      <div className="h-2 w-full rounded bg-muted-foreground/15" />
      <div className="h-2 w-3/4 rounded bg-muted-foreground/15" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="h-20 rounded-lg bg-secondary/60" />
      <div className="h-20 rounded-lg bg-secondary/60" />
    </div>
    <div className="h-8 rounded-lg bg-secondary/40" />
  </div>
);

export default function ProjectPreviewMock({ type, className }: Props) {
  return (
    <div className={className}>
      {type === "portfolio" && <PortfolioPreview />}
      {type === "dashboard" && <DashboardPreview />}
      {type === "landing" && <LandingPreview />}
      {type === "generic" && <GenericPreview />}
    </div>
  );
}
