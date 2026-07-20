import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Wand2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const GENERATE_STAGES = ["Thinking...", "Generating...", "Creating components...", "Building UI..."];

const suggestions = [
  { label: "Create job board website", preview: "job-board" },
  { label: "Build SaaS dashboard", preview: "dashboard" },
  { label: "Make portfolio site", preview: "portfolio" },
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
  const [prompt, setPrompt] = useState(suggestions[1].label);
  const [active, setActive] = useState("dashboard");
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [runId, setRunId] = useState(0);

  const current = previews[active];

  const handleGenerate = () => {
    setGenerating(true);
    setReady(false);
    setStageIndex(0);
  };

  useEffect(() => {
    if (!generating) return;
    if (stageIndex < GENERATE_STAGES.length - 1) {
      const t = setTimeout(() => setStageIndex((v) => v + 1), 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setReady(true), 420);
    return () => clearTimeout(t);
  }, [generating, stageIndex]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      setGenerating(false);
      setReady(false);
      setRunId((v) => v + 1);
    }, 500);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <section id="demo" className="py-20 lg:py-28 bg-gray-50/60">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-blue-600 mb-3 block">Try It Live</span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            See WebdevsAI in action
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Pick a prompt, hit generate, and watch a real UI preview take shape.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-stretch max-w-5xl mx-auto">
          {/* Prompt input side */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 flex flex-col shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 size={16} className="text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">Describe your app</span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
              placeholder="Describe the app you want to build..."
            />

            <div className="mt-4">
              <p className="text-xs font-medium text-gray-400 mb-2.5">Or try a suggestion</p>
              <div className="flex flex-col gap-2">
                {suggestions.map(({ label, preview }) => (
                  <button
                    key={preview}
                    onClick={() => {
                      setPrompt(label);
                      setActive(preview);
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                      active === preview
                        ? "border-blue-300 bg-blue-50 text-blue-700 font-medium"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    "{label}"
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="mt-6 bg-blue-600 text-white hover:bg-blue-700 w-full gap-2 shadow-sm hover:shadow-md transition-all"
            >
              <Sparkles size={16} />
              {generating ? "Generating..." : "Generate"}
            </Button>
          </div>

          {/* Live preview side */}
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <span className="w-3 h-3 rounded-full bg-red-400/70" />
              <span className="w-3 h-3 rounded-full bg-amber-400/70" />
              <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-xs font-medium text-gray-500">Preview — {current.title}</span>
            </div>
            <div className="p-5 min-h-[280px]">
              {generating ? (
                <div className="flex flex-col justify-center h-[240px] gap-2.5 px-4">
                  {ready ? (
                    <div className="fade-up flex flex-col items-center justify-center gap-2 text-emerald-600">
                      <Check size={28} className="rounded-full bg-emerald-50 p-1" />
                      <span className="text-sm font-medium">Preview Ready</span>
                    </div>
                  ) : (
                    GENERATE_STAGES.map((stage, i) => (
                      <div key={stage} className="flex items-center gap-2.5 text-sm">
                        {i < stageIndex ? (
                          <Check size={14} className="text-emerald-600 shrink-0" />
                        ) : i === stageIndex ? (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-gray-200 shrink-0" />
                        )}
                        <span className={i <= stageIndex ? "text-gray-700" : "text-gray-300"}>{stage}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3 fade-up" key={runId}>
                  <div className="h-6 w-40 rounded bg-gray-100" />
                  {current.blocks.map((block, i) => (
                    <div
                      key={block}
                      className="rounded-lg bg-gray-50 border border-gray-100 p-4 flex items-center gap-3 fade-up"
                      style={{ animationDelay: `${i * 0.08}s` }}
                    >
                      <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-cyan-400 opacity-80 shrink-0" />
                      <span className="text-sm text-gray-500">{block}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2" asChild>
            <Link to="/signup">
              Try it yourself <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Demo;
