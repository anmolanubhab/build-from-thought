import { Globe, Github } from "lucide-react";
import { VercelIcon } from "./TechIcons";

const options = [
  {
    Icon: VercelIcon,
    title: "Deploy to Vercel",
    desc: "Connect your Vercel account and push your app live with one click.",
  },
  {
    Icon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M16.24 3.56 20.44 7.76 12 16.2 3.56 7.76 7.76 3.56h8.48zM12 2 6.34 2 2 6.34v11.32L6.34 22h11.32L22 17.66V6.34L17.66 2H12zm5.9 6.9-4.65 4.65-2.5-2.5-4.65 4.65 1.4 1.4 3.25-3.25 2.5 2.5 6.05-6.05-1.4-1.4z" />
      </svg>
    ),
    title: "Deploy to Netlify",
    desc: "Link a Netlify site and deploy straight from your project dashboard.",
  },
  {
    Icon: Github,
    title: "Push to GitHub",
    desc: "Export your generated code to a GitHub repo you own and control.",
  },
  {
    Icon: Globe,
    title: "Custom Domains",
    desc: "Point your own domain at any deployment in a few clicks.",
  },
];

const DeployAnywhere = () => (
  <section id="deploy" className="py-20 lg:py-28 bg-white">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <span className="text-sm font-semibold text-blue-600 mb-3 block">Deploy Anywhere</span>
        <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
          Ship to the platforms you already use
        </h2>
        <p className="text-gray-500 max-w-xl mx-auto">
          No lock-in. Connect your accounts and deploy where your project lives.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
        {options.map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            className="rounded-2xl border border-gray-200 bg-white p-6 fade-up transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/60 hover:border-gray-300"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4 text-gray-700">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-gray-900 mb-1.5">{title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default DeployAnywhere;
