import {
  Sparkles,
  Monitor,
  Code2,
  CloudUpload,
  Share2,
  Github,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI App Generation",
    desc: "Describe your idea in plain English and let AI generate a complete, working application.",
  },
  {
    icon: Monitor,
    title: "Live Preview",
    desc: "Watch your app render in real time as it's built — no refresh, no waiting.",
  },
  {
    icon: Code2,
    title: "Code Editing",
    desc: "Jump into the generated code and refine it directly in a full-featured editor.",
  },
  {
    icon: CloudUpload,
    title: "One-Click Deployment",
    desc: "Ship your app to production in a single click, with zero infrastructure setup.",
  },
  {
    icon: Share2,
    title: "Share Projects",
    desc: "Send a live link so teammates or clients can view and try your app instantly.",
  },
  {
    icon: Github,
    title: "GitHub Integration",
    desc: "Push your generated code straight to a GitHub repository you control.",
  },
  {
    icon: ShieldCheck,
    title: "Authentication",
    desc: "Built-in sign-up, login, and session handling, ready to use out of the box.",
  },
  {
    icon: Smartphone,
    title: "Responsive Design",
    desc: "Every generated app works cleanly across desktop, tablet, and mobile.",
  },
];

const Features = () => (
  <section id="features" className="py-20 lg:py-28 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <span className="text-sm font-semibold text-blue-600 mb-3 block">Why WebdevsAI</span>
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Everything you need, built in
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">
          Real capabilities that take you from idea to production, not just a pretty prompt box.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="group rounded-2xl border border-gray-200 bg-white p-6 fade-up transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/60 hover:border-gray-300"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-blue-100 group-hover:scale-110 group-hover:-rotate-6">
              <Icon size={20} className="text-blue-600 transition-transform duration-300 group-hover:rotate-6" />
            </div>
            <h3 className="font-display text-base font-bold text-gray-900 mb-1.5">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
