import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ShoppingBag, User, MessageSquare, Rocket } from "lucide-react";

const templates = [
  { icon: LayoutDashboard, title: "SaaS Dashboard", color: "#ff3cac" },
  { icon: ShoppingBag, title: "Marketplace App", color: "#784ba0" },
  { icon: User, title: "Portfolio Website", color: "#2b86c5" },
  { icon: MessageSquare, title: "AI Chat App", color: "#ff3cac" },
  { icon: Rocket, title: "Startup Landing Page", color: "#784ba0" },
];

const Templates = () => (
  <section id="templates" className="py-20 lg:py-28">
    <div className="container mx-auto px-4">
      <h2 className="font-display text-3xl lg:text-4xl font-bold text-center mb-4">
        Start From a <span className="gradient-text">Template</span>
      </h2>
      <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
        Choose a pre-built template and customize it to your needs.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {templates.map(({ icon: Icon, title, color }, i) => (
          <div
            key={title}
            className="glass rounded-xl overflow-hidden neon-glow fade-up group"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div
              className="h-36 flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)` }}
            >
              <Icon size={40} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="p-4 text-center">
              <h3 className="font-display font-bold text-foreground text-sm mb-3">{title}</h3>
              <Button size="sm" variant="outline" className="text-xs border-border/60 hover:bg-accent w-full" asChild>
                <Link to="/signup">Use Template</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Templates;
