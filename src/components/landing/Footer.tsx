const columns = [
  { title: "Product", links: ["Features", "Templates", "Docs"] },
  { title: "Company", links: ["About", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms"] },
];

const Footer = () => (
  <footer className="border-t border-border/40 py-12">
    <div className="container mx-auto px-4">
      <div className="grid sm:grid-cols-4 gap-8">
        <div>
          <span className="font-display text-lg font-bold text-foreground">
            Webdevs<span className="gradient-text">AI</span>
          </span>
          <p className="text-sm text-muted-foreground mt-3">Build web apps from a single prompt.</p>
        </div>
        {columns.map(({ title, links }) => (
          <div key={title}>
            <h4 className="font-display font-semibold text-foreground text-sm mb-4">{title}</h4>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 pt-6 border-t border-border/40 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} WebdevsAI. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
