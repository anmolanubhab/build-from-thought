import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    features: ["5 projects", "AI prompt builder", "Community support", "Basic templates"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    features: ["Unlimited projects", "Full-stack export", "Priority support", "All templates", "Custom domains"],
    cta: "Get Started",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: ["Unlimited everything", "Dedicated support", "SSO & SAML", "SLA guarantee", "On-premise option"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const Pricing = () => (
  <section id="pricing" className="py-20 lg:py-28">
    <div className="container mx-auto px-4">
      <h2 className="font-display text-3xl lg:text-4xl font-bold text-center mb-4">
        Simple <span className="gradient-text">Pricing</span>
      </h2>
      <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
        Start free, upgrade when you're ready.
      </p>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map(({ name, price, period, features, cta, highlighted }, i) => (
          <div
            key={name}
            className={`rounded-xl p-6 fade-up flex flex-col ${
              highlighted ? "gradient-border glass" : "glass"
            }`}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <h3 className="font-display text-lg font-bold text-foreground mb-1">{name}</h3>
            <div className="mb-6">
              <span className="font-display text-4xl font-extrabold text-foreground">{price}</span>
              <span className="text-sm text-muted-foreground">{period}</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check size={16} className="text-foreground shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Button
              className={`w-full ${highlighted ? "gradient-bg text-primary-foreground border-0 hover:opacity-90" : "border-border/60"}`}
              variant={highlighted ? "default" : "outline"}
              asChild
            >
              <Link to="/signup">{cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Pricing;
