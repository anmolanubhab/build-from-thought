import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ShoppingBag, User, MessageSquare, Rocket } from "lucide-react";

const templates = [
  { icon: LayoutDashboard, title: "SaaS Dashboard", categories: ["SaaS", "Dashboard"] },
  { icon: ShoppingBag, title: "Marketplace App", categories: ["Ecommerce"] },
  { icon: User, title: "Portfolio Website", categories: ["Portfolio"] },
  { icon: MessageSquare, title: "AI Chat App", categories: ["SaaS", "AI"] },
  { icon: Rocket, title: "Startup Landing Page", categories: ["Landing Page"] },
];

const categories = ["All", ...Array.from(new Set(templates.flatMap((t) => t.categories)))];

const Templates = () => {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All" ? templates : templates.filter((t) => t.categories.includes(activeCategory));

  return (
    <section id="templates" className="py-20 lg:py-28 bg-gray-50/60">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <span className="text-sm font-semibold text-blue-600 mb-3 block">Examples</span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Start from a template
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            A sample of what you can build and customize with a single prompt.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                activeCategory === cat
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {filtered.map(({ icon: Icon, title }, i) => (
            <div
              key={title}
              className="group rounded-2xl border border-gray-200 bg-white overflow-hidden fade-up transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/60 hover:border-gray-300"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="h-32 flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
                <Icon size={32} className="text-blue-500/70 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-display font-bold text-gray-900 text-sm mb-3">{title}</h3>
                <Button size="sm" variant="outline" className="text-xs border-gray-300 text-gray-600 hover:bg-gray-50 w-full" asChild>
                  <Link to="/signup">Use Template</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Templates;
