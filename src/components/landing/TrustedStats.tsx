import { ReactIcon, TypeScriptIcon, TailwindIcon, SupabaseIcon, VercelIcon, GitHubIcon } from "./TechIcons";

const stack = [
  { name: "React", Icon: ReactIcon },
  { name: "TypeScript", Icon: TypeScriptIcon },
  { name: "Tailwind CSS", Icon: TailwindIcon },
  { name: "Supabase", Icon: SupabaseIcon },
  { name: "Vercel", Icon: VercelIcon },
  { name: "GitHub", Icon: GitHubIcon },
];

const TrustedStats = () => (
  <section className="py-16 border-y border-gray-100 bg-gray-50/50">
    <div className="container mx-auto px-4">
      <p className="text-center text-xs font-semibold tracking-widest text-gray-400 uppercase mb-10">
        Built on a modern, production-grade stack
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
        {stack.map(({ name, Icon }) => (
          <div key={name} className="flex items-center gap-2.5 text-gray-400 hover:text-gray-700 transition-colors">
            <Icon className="w-6 h-6" />
            <span className="text-sm font-medium">{name}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustedStats;
