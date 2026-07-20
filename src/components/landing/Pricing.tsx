// path: src/components/landing/Pricing.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlanInterestDialog from "./PlanInterestDialog";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "/month",
    features: ["5 projects", "AI prompt builder", "Community support", "Basic templates"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$29",
    period: "/month",
    features: ["Unlimited projects", "Full-stack export", "Priority support", "All templates", "Custom domains"],
    cta: "Join Waitlist",
    highlighted: true,
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: ["Unlimited everything", "Dedicated support", "SSO & SAML", "SLA guarantee", "On-premise option"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const Pricing = () => {
  const [dialogPlan, setDialogPlan] = useState<"pro" | "enterprise" | null>(null);

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-gray-50/60">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-blue-600 mb-3 block">Pricing</span>
          <h2 className="font-display text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">Start free, upgrade when you're ready.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map(({ id, name, price, period, features, cta, highlighted }, i) => (
            <div
              key={name}
              className={`rounded-2xl p-7 fade-up flex flex-col bg-white transition-all duration-300 ${
                highlighted
                  ? "border-2 border-blue-600 shadow-xl shadow-blue-100 md:-translate-y-2"
                  : "border border-gray-200 shadow-sm hover:shadow-md"
              }`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {highlighted && (
                <span className="self-start mb-3 text-[11px] font-semibold tracking-wide text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  MOST POPULAR
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-gray-900 mb-1">{name}</h3>
              <div className="mb-6">
                <span className="font-display text-4xl font-extrabold text-gray-900">{price}</span>
                <span className="text-sm text-gray-500">{period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Check size={16} className="text-blue-600 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                <Button
                  className={`w-full ${
                    highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  variant={highlighted ? "default" : "outline"}
                  asChild
                >
                  <Link to="/signup">{cta}</Link>
                </Button>
              ) : (
                <Button
                  className={`w-full ${
                    highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  variant={highlighted ? "default" : "outline"}
                  onClick={() => setDialogPlan(id)}
                >
                  {cta}
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
            Pro &amp; Enterprise are in Early Access
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            Free plan is live now — no card required
          </span>
        </div>
      </div>

      {dialogPlan && (
        <PlanInterestDialog open={!!dialogPlan} onClose={() => setDialogPlan(null)} plan={dialogPlan} />
      )}
    </section>
  );
};

export default Pricing;
