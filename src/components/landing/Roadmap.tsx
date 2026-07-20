import { CheckCircle2, Clock } from "lucide-react";

const now = ["AI App Generation", "Live Preview", "Code Editing", "One-Click Deployment", "GitHub Integration"];
const comingSoon = ["Team Collaboration", "Plugin Marketplace", "Version History"];

const Roadmap = () => (
  <section id="roadmap" className="py-20 lg:py-28 bg-gray-50/60">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <span className="text-sm font-semibold text-blue-600 mb-3 block">Roadmap</span>
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Built today, growing every week
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">What's live right now, and what's coming next.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white p-7">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="font-display text-base font-bold text-gray-900">Now</h3>
          </div>
          <ul className="space-y-3.5">
            {now.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-7">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            <h3 className="font-display text-base font-bold text-gray-900">Coming Soon</h3>
          </div>
          <ul className="space-y-3.5">
            {comingSoon.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-gray-500">
                <Clock size={16} className="text-gray-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

export default Roadmap;
