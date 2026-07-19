import { useState } from "react";
import { Link } from "react-router-dom";
import { Code2, BarChart3, Briefcase, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const prompts = [
  { label: "Create job board website", icon: Briefcase, preview: "job-board" },
  { label: "Build SaaS dashboard", icon: BarChart3, preview: "dashboard" },
  { label: "Make portfolio site", icon: User, preview: "portfolio" },
];

const previews: Record<string, { title: string; blocks: string[] }> = {
  "job-board": {
    title: "Job Board",
    blocks: ["Search bar + filters", "Job listing cards (3)", "Sidebar with categories", "Apply now modal"],
  },
  dashboard: {
    title: "SaaS Dashboard",
    blocks: ["Revenue chart", "User growth metrics", "Recent activity feed", "Settings panel"],
  },
  portfolio: {
    title: "Portfolio Site",
    blocks: ["Hero with avatar", "Projects grid (6)", "Skills section", "Contact form"],
  },
};

const Demo = () => {
  const [active, setActive] = useState("dashboard");

  const current = previews[active];

  return (
    <section id="docs" className="py-20 lg:py-28">
      <div className="container mx-auto px-4">
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-center mb-4">
          See <span className="gradient-text">WebdevsAI</span> in Action
        </h2>
        <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
          Click a prompt and watch the AI generate a full UI preview instantly.
        </p>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Prompt selector */}
          <div className="glass rounded-xl p-6 space-y-4 neon-glow flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Code2 size={18} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Choose a prompt</span>
            </div>
            <div className="space-y-3 flex-1">
              {prompts.map(({ label, icon: Icon, preview }) => (
                <button
                  key={preview}
                  onClick={() => setActive(preview)}
                  className={`w-full text-left p-4 rounded-lg border transition-all duration-200 flex items-center gap-3 ${
                    active === preview
                      ? "gradient-border bg-accent/40"
                      : "border-border/40 hover:border-border/70 hover:bg-accent/20"
                  }`}
                >
                  <Icon size={18} className={active === preview ? "text-foreground" : "text-muted-foreground"} />
                  <span className={`text-sm ${active === preview ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    "{label}"
                  </span>
                </button>
              ))}
            </div>
            <Button className="gradient-bg text-primary-foreground border-0 hover:opacity-90 w-full mt-auto" asChild>
              <Link to="/signup">Try It Yourself</Link>
            </Button>
          </div>

          {/* Live preview */}
          <div className="glass rounded-xl overflow-hidden neon-glow">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
              <span className="w-3 h-3 rounded-full bg-destructive/70" />
              <span className="w-3 h-3 rounded-full bg-[hsl(48,96%,53%)]/70" />
              <span className="w-3 h-3 rounded-full bg-[hsl(142,69%,58%)]/70" />
              <span className="ml-3 text-xs text-muted-foreground">Preview — {current.title}</span>
            </div>
            <div className="p-5" key={active}>
              <div className="space-y-3 fade-up">
                <div className="h-6 w-40 rounded bg-foreground/10" />
                {current.blocks.map((block, i) => (
                  <div
                    key={block}
                    className="rounded-lg bg-secondary/60 p-4 flex items-center gap-3 fade-up"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="w-8 h-8 rounded gradient-bg opacity-60 shrink-0" />
                    <span className="text-sm text-muted-foreground">{block}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Demo;
