// path: src/components/landing/Footer.tsx
import { Link } from "react-router-dom";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "Templates", href: "#templates" },
      { label: "Pricing", href: "#pricing" },
      { label: "Roadmap", href: "#roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Deploy Anywhere", href: "#deploy" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-gray-200 py-14 bg-white">
    <div className="container mx-auto px-4">
      <div className="grid sm:grid-cols-5 gap-10">
        <div className="sm:col-span-2">
          <img src="/logo.png" alt="WebdevsAI" className="h-8 w-auto" />
          <p className="text-sm text-gray-500 mt-3 max-w-xs leading-relaxed">
            Build production-ready web apps from a single prompt.
          </p>
        </div>
        {columns.map(({ title, links }) => (
          <div key={title}>
            <h4 className="font-display font-semibold text-gray-900 text-sm mb-4">{title}</h4>
            <ul className="space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("#") ? (
                    <a href={link.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} WebdevsAI. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
