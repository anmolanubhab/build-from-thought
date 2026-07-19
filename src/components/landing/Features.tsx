import { Sparkles, Monitor, Code2, Database, ShieldCheck, CloudUpload } from "lucide-react";

const features = [
  { icon: Sparkles, title: "AI Prompt Builder", desc: "Write a natural language prompt and let AI interpret your vision into a complete app." },
  { icon: Monitor, title: "Live UI Generator", desc: "See your app come to life instantly with a real-time visual preview." },
  { icon: Code2, title: "Full-Stack Code Export", desc: "Export production-ready frontend and backend code you fully own." },
  { icon: Database, title: "Database Integration", desc: "Auto-generate schemas, tables, and queries — no SQL required." },
  { icon: ShieldCheck, title: "Authentication System", desc: "Built-in user auth with login, signup, and role management." },
  { icon: CloudUpload, title: "Deployment Ready", desc: "One-click deploy to a global CDN with a custom domain." },
];

const Features = () => (
  <section id="features" className="py-20 lg:py-28">
    <div className="container mx-auto px-4">
      <h2 className="font-display text-3xl lg:text-4xl font-bold text-center mb-4">
        Powerful <span className="gradient-text">Features</span>
      </h2>
      <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
        Everything you need to build, ship, and scale web apps with AI.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="glass rounded-xl p-6 neon-glow fade-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="w-12 h-12 rounded-lg gradient-bg flex items-center justify-center mb-4">
              <Icon size={22} className="text-primary-foreground" />
            </div>
            <h3 className="font-display text-lg font-bold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
