import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Play, BarChart3, Users, Settings, Home, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const PROMPT_TEXT = 'Create a SaaS dashboard with login and analytics';

const Hero = () => {
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<"typing" | "loading" | "preview">("typing");

  useEffect(() => {
    if (phase !== "typing") return;
    if (displayedText.length < PROMPT_TEXT.length) {
      const t = setTimeout(() => setDisplayedText(PROMPT_TEXT.slice(0, displayedText.length + 1)), 45);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("loading"), 600);
    return () => clearTimeout(t);
  }, [displayedText, phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setPhase("preview"), 1800);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
      <div className="glow-orb w-[500px] h-[500px] bg-[hsl(330,100%,62%)] top-0 -left-40 animate-pulse-glow" />
      <div className="glow-orb w-[400px] h-[400px] bg-[hsl(202,64%,47%)] top-20 right-0 animate-pulse-glow" style={{ animationDelay: "2s" }} />

      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div className="fade-up">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
              Build Full Web Apps{" "}
              <span className="gradient-text">From One Prompt</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Describe your idea and WebdevsAI instantly generates a working web application — UI, code, and all.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="gradient-bg text-primary-foreground border-0 hover:opacity-90 gap-2" asChild>
                <Link to="/signup">Start Building <ArrowRight size={18} /></Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-border/60 text-foreground hover:bg-accent"
                onClick={() => document.getElementById("docs")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play size={18} /> Watch Demo
              </Button>
            </div>
          </div>

          {/* Right — mock IDE */}
          <div className="fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="glass rounded-xl overflow-hidden neon-glow">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
                <span className="w-3 h-3 rounded-full bg-destructive/70" />
                <span className="w-3 h-3 rounded-full bg-[hsl(48,96%,53%)]/70" />
                <span className="w-3 h-3 rounded-full bg-[hsl(142,69%,58%)]/70" />
                <span className="ml-3 text-xs text-muted-foreground">WebdevsAI Builder</span>
              </div>

              <div className="p-5 space-y-4">
                {/* Prompt area with typing */}
                <div className="glass rounded-lg p-3 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Prompt:</span>
                  <span className="text-sm text-foreground/80">
                    {displayedText}
                    {phase === "typing" && (
                      <span className="inline-block w-0.5 h-4 bg-foreground/70 ml-0.5 animate-pulse align-middle" />
                    )}
                  </span>
                </div>

                {/* Loading state */}
                {phase === "loading" && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground animate-pulse">
                    <span className="w-2 h-2 rounded-full gradient-bg animate-bounce" />
                    <span className="w-2 h-2 rounded-full gradient-bg animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="w-2 h-2 rounded-full gradient-bg animate-bounce" style={{ animationDelay: "0.3s" }} />
                    <span className="ml-2">AI generating UI...</span>
                  </div>
                )}

                {/* Generated dashboard preview */}
                {phase === "preview" && (
                  <div className="rounded-lg bg-secondary/60 overflow-hidden fade-up">
                    <div className="flex">
                      {/* Sidebar */}
                      <div className="w-14 border-r border-border/30 py-3 flex flex-col items-center gap-3">
                        <Home size={16} className="text-muted-foreground" />
                        <BarChart3 size={16} className="text-foreground" />
                        <Users size={16} className="text-muted-foreground" />
                        <Settings size={16} className="text-muted-foreground" />
                      </div>
                      {/* Main */}
                      <div className="flex-1 p-3 space-y-3">
                        {/* Top bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Search size={14} className="text-muted-foreground" />
                            <div className="h-5 w-32 rounded bg-border/40" />
                          </div>
                          <Bell size={14} className="text-muted-foreground" />
                        </div>
                        {/* Stat cards */}
                        <div className="grid grid-cols-3 gap-2">
                          {["Revenue", "Users", "Growth"].map((label, i) => (
                            <div key={label} className="rounded-md bg-background/40 p-2 text-center">
                              <div className="text-[10px] text-muted-foreground">{label}</div>
                              <div className="text-sm font-bold text-foreground">{["$12.4K", "1,847", "+23%"][i]}</div>
                            </div>
                          ))}
                        </div>
                        {/* Chart area */}
                        <div className="h-20 rounded-md bg-background/30 flex items-end gap-1 p-2">
                          {[40, 65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t gradient-bg opacity-70"
                              style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Initial shimmer state */}
                {phase === "typing" && (
                  <div className="rounded-lg bg-secondary/60 p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="h-8 w-24 rounded-md shimmer" />
                      <div className="h-8 flex-1 rounded-md shimmer" style={{ animationDelay: "0.3s" }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-20 rounded-lg shimmer" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
