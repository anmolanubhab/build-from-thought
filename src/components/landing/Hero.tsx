import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Play,
  Sparkles,
  BarChart3,
  Users,
  Settings,
  Home,
  Bell,
  Search,
  Globe,
  CheckCircle2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PROMPT_TEXT = "Create a SaaS dashboard with login and analytics";

type Phase = "typing" | "loading" | "code" | "preview" | "deployed";

const STEPS: { key: Phase; label: string }[] = [
  { key: "typing", label: "Prompt" },
  { key: "loading", label: "Generating" },
  { key: "code", label: "Code" },
  { key: "preview", label: "Preview" },
  { key: "deployed", label: "Deploy" },
];

const CODE_LINES = [
  { text: "export function Dashboard() {", indent: 0 },
  { text: "const { data } = useAnalytics();", indent: 1 },
  { text: "return (", indent: 1 },
  { text: "<AuthGuard>", indent: 2 },
  { text: "<StatsGrid data={data} />", indent: 3 },
  { text: "</AuthGuard>", indent: 2 },
  { text: ");", indent: 1 },
  { text: "}", indent: 0 },
];

const Hero = () => {
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");

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
    const t = setTimeout(() => setPhase("code"), 1400);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "code") return;
    const t = setTimeout(() => setPhase("preview"), 1600);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "preview") return;
    const t = setTimeout(() => setPhase("deployed"), 2200);
    return () => clearTimeout(t);
  }, [phase]);

  const activeStepIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden bg-white">
      {/* Extremely subtle radial accents */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[700px]"
        style={{
          background:
            "radial-gradient(600px circle at 20% 10%, rgba(37,99,235,0.06), transparent 60%), radial-gradient(500px circle at 85% 20%, rgba(6,182,212,0.05), transparent 60%)",
        }}
      />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-16 items-center">
          {/* Left */}
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 mb-6">
              <Sparkles size={14} className="text-blue-600" />
              <span className="text-xs font-medium text-gray-700">AI-Powered App Builder</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.3rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 mb-6">
              From{" "}
              <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                One Prompt
              </span>{" "}
              to a Live Production App
            </h1>
            <p className="text-lg text-gray-500 mb-9 max-w-lg leading-relaxed">
              Generate, edit, preview and deploy modern web applications in minutes — powered by AI.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 shadow-sm hover:shadow-lg transition-all gap-2 px-6"
                asChild
              >
                <Link to="/signup">
                  Start Building Free <ArrowRight size={18} />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all"
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play size={18} /> Watch 90-Second Demo
              </Button>
            </div>
          </div>

          {/* Right — app preview mockup */}
          <div className="fade-up" style={{ animationDelay: "0.15s" }}>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/60 overflow-hidden animate-float">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <span className="w-3 h-3 rounded-full bg-red-400/70" />
                <span className="w-3 h-3 rounded-full bg-amber-400/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-xs font-medium text-gray-500">WebdevsAI Builder</span>
                <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                  <Globe size={12} /> app.webdevsai.io
                </span>
              </div>

              {/* Step tracker */}
              <div className="flex items-center justify-between px-5 pt-4 pb-1">
                {STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors duration-300 ${
                          i < activeStepIndex
                            ? "bg-blue-600 text-white"
                            : i === activeStepIndex
                              ? "bg-blue-600 text-white ring-4 ring-blue-100"
                              : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {i < activeStepIndex ? <Check size={11} /> : i + 1}
                      </div>
                      <span
                        className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-300 ${
                          i <= activeStepIndex ? "text-gray-700" : "text-gray-300"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`h-px flex-1 mx-1 mb-4 transition-colors duration-300 ${
                          i < activeStepIndex ? "bg-blue-600" : "bg-gray-100"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex">
                {/* Sidebar */}
                <div className="hidden sm:flex w-14 border-r border-gray-100 py-4 flex-col items-center gap-4 bg-gray-50/40">
                  <Home size={16} className="text-gray-400" />
                  <BarChart3 size={16} className="text-blue-600" />
                  <Users size={16} className="text-gray-400" />
                  <Settings size={16} className="text-gray-400" />
                </div>

                <div className="flex-1 p-5 space-y-4">
                  {/* Prompt area with typing */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-400 whitespace-nowrap">Prompt</span>
                    <span className="text-sm text-gray-700">
                      {displayedText}
                      {phase === "typing" && (
                        <span className="inline-block w-0.5 h-4 bg-blue-600 ml-0.5 animate-pulse align-middle" />
                      )}
                    </span>
                  </div>

                  {/* Loading state */}
                  {phase === "loading" && (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0.3s" }} />
                      <span className="ml-2">AI generating UI...</span>
                    </div>
                  )}

                  {/* Code phase */}
                  {phase === "code" && (
                    <div className="fade-up rounded-lg bg-gray-900 p-4 font-mono text-[11px] leading-relaxed overflow-hidden">
                      {CODE_LINES.map((line, i) => (
                        <div
                          key={i}
                          className="text-gray-300 fade-up whitespace-pre"
                          style={{ paddingLeft: `${line.indent * 12}px`, animationDelay: `${i * 0.06}s` }}
                        >
                          <span className="text-cyan-400">{line.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated dashboard preview */}
                  {(phase === "preview" || phase === "deployed") && (
                    <div className="rounded-lg border border-gray-100 bg-gray-50/60 overflow-hidden fade-up">
                      <div className="p-3 space-y-3">
                        {/* Top bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Search size={13} className="text-gray-400" />
                            <div className="h-4 w-28 rounded bg-gray-200/70" />
                          </div>
                          <Bell size={13} className="text-gray-400" />
                        </div>
                        {/* Stat cards */}
                        <div className="grid grid-cols-3 gap-2">
                          {["Revenue", "Users", "Growth"].map((label, i) => (
                            <div key={label} className="rounded-md bg-white border border-gray-100 p-2 text-center">
                              <div className="text-[10px] text-gray-400">{label}</div>
                              <div className="text-sm font-bold text-gray-900">
                                {["$12.4K", "1,847", "+23%"][i]}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Chart area */}
                        <div className="h-16 rounded-md bg-white border border-gray-100 flex items-end gap-1 p-2">
                          {[40, 65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-cyan-400 opacity-80"
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Initial shimmer skeleton */}
                  {phase === "typing" && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-3">
                      <div className="flex gap-3">
                        <div className="h-8 w-24 rounded-md bg-gray-100 animate-pulse" />
                        <div className="h-8 flex-1 rounded-md bg-gray-100 animate-pulse" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deployment status */}
                  {phase === "deployed" && (
                    <div className="fade-up flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-700">Deployed — Live URL ready</span>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-600">Live in 4.2s</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
