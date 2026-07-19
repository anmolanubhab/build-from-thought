// path: src/pages/Resources.tsx
import { useNavigate } from "react-router-dom";
import { Menu, User, LayoutDashboard, Rocket, Building2, Newspaper, ArrowRight } from "lucide-react";
import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import type { ProjectFilter } from "@/components/dashboard/Sidebar";

interface Template {
  id: string;
  title: string;
  description: string;
  icon: typeof User;
  color: string;
  prompt: string;
  multipage: boolean;
}

const templates: Template[] = [
  {
    id: "portfolio",
    title: "Developer Portfolio",
    description: "Hero section, project grid, skills, and a contact form.",
    icon: User,
    color: "#ff3cac",
    prompt: "A modern portfolio website for a developer with a hero section, a projects grid, a skills section, and a contact form",
    multipage: false,
  },
  {
    id: "dashboard",
    title: "SaaS Analytics Dashboard",
    description: "Sidebar nav, KPI stat cards, and a revenue chart.",
    icon: LayoutDashboard,
    color: "#784ba0",
    prompt: "An admin analytics dashboard with sidebar navigation, KPI stat cards for users, revenue and growth, and a revenue chart",
    multipage: false,
  },
  {
    id: "landing",
    title: "Startup Landing Page",
    description: "Hero, features grid, pricing, and testimonials.",
    icon: Rocket,
    color: "#2b86c5",
    prompt: "A SaaS startup landing page with a hero section, a features grid, pricing cards, and testimonials",
    multipage: false,
  },
  {
    id: "business",
    title: "Multi-page Business Site",
    description: "Home, About, Services, and Contact — with shared nav.",
    icon: Building2,
    color: "#ff3cac",
    prompt: "A small business website with Home, About, Services, and Contact pages",
    multipage: true,
  },
  {
    id: "blog",
    title: "Personal Blog",
    description: "Home, About, Blog, and Contact — with shared nav.",
    icon: Newspaper,
    color: "#784ba0",
    prompt: "A multi-page personal blog with Home, About, Blog, and Contact pages",
    multipage: true,
  },
];

export default function Resources() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const useTemplate = (t: Template) => {
    const params = new URLSearchParams({
      template_prompt: t.prompt,
      template_multipage: String(t.multipage),
    });
    navigate(`/dashboard?${params.toString()}`);
  };

  // Sidebar needs these props but Resources doesn't manage a project list/filter itself.
  const noop = () => {};

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        projects={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeFilter={"all" as ProjectFilter}
        onFilterChange={noop}
        searchQuery=""
        onSearchChange={noop}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="lg:hidden h-12 bg-white border-b border-gray-200 flex items-center px-4">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Resources</h1>
            <p className="text-gray-500 mb-8">Start from a template and let AI fill in the details.</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => useTemplate(t)}
                  className="text-left rounded-2xl overflow-hidden border border-gray-100 bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div
                    className="h-28 flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${t.color}22, ${t.color}08)` }}
                  >
                    <t.icon className="h-9 w-9" style={{ color: t.color }} />
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{t.title}</h3>
                    <p className="text-xs text-gray-500 mb-3">{t.description}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 group-hover:gap-1.5 transition-all">
                      Use this template <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
