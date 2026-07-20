import { MessageSquare, Cpu, Pencil, Rocket, Share2 } from "lucide-react";

const steps = [
  { icon: MessageSquare, title: "Describe Your Idea", description: "Tell WebdevsAI what you want to build, in plain English." },
  { icon: Cpu, title: "AI Generates Your App", description: "It writes the UI, logic, and working code automatically." },
  { icon: Pencil, title: "Edit Visually or in Code", description: "Refine the design or jump straight into the code editor." },
  { icon: Rocket, title: "Deploy", description: "Ship it to production with a single click." },
  { icon: Share2, title: "Share Your Live App", description: "Send a live link to teammates, clients, or the world." },
];

const HowItWorks = () => (
  <section id="how-it-works" className="py-20 lg:py-28 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 mb-3 bg-blue-50 px-3 py-1 rounded-full">
          Build in under 60 seconds
        </span>
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight mt-3">
          From idea to deployed app
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">Five simple steps, no infrastructure to manage.</p>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-8 relative">
        <div className="hidden md:block absolute top-9 left-[10%] right-[10%] h-px bg-gray-200" />

        {steps.map(({ icon: Icon, title, description }, i) => (
          <div key={title} className="relative flex flex-col items-center text-center fade-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="w-[72px] h-[72px] rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center justify-center mb-5 relative z-10">
              <Icon size={24} className="text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-blue-600 mb-2">Step {i + 1}</span>
            <h3 className="font-display text-base font-bold text-gray-900 mb-1.5">{title}</h3>
            <p className="text-sm text-gray-500 max-w-[180px]">{description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
