import { PenLine, Cpu, Rocket } from "lucide-react";

const steps = [
  { icon: PenLine, title: "Write Your Idea", description: "Describe the app you want to build in plain English." },
  { icon: Cpu, title: "AI Generates the App", description: "Our AI instantly creates the UI, logic, and working code." },
  { icon: Rocket, title: "Edit & Deploy", description: "Customize your app and deploy it live in one click." },
];

const HowItWorks = () => (
  <section className="py-20 lg:py-28">
    <div className="container mx-auto px-4">
      <h2 className="font-display text-3xl lg:text-4xl font-bold text-center mb-4">
        How It <span className="gradient-text">Works</span>
      </h2>
      <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
        Go from idea to deployed app in three simple steps.
      </p>

      <div className="grid md:grid-cols-3 gap-8 relative">
        {/* Connecting line (desktop) */}
        <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px bg-gradient-to-r from-[#ff3cac] via-[#784ba0] to-[#2b86c5] opacity-40" />

        {steps.map(({ icon: Icon, title, description }, i) => (
          <div key={title} className="flex flex-col items-center text-center fade-up" style={{ animationDelay: `${i * 0.15}s` }}>
            <div className="w-24 h-24 rounded-2xl glass flex items-center justify-center mb-6 neon-glow relative z-10">
              <Icon size={32} className="text-foreground" />
            </div>
            <span className="text-xs font-semibold gradient-text mb-2">Step {i + 1}</span>
            <h3 className="font-display text-xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
