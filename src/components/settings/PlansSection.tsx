// path: src/components/settings/PlansSection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfileCredits } from "@/services/db";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import SettingsCard from "./SettingsCard";
import UpgradeDialog from "@/components/dashboard/UpgradeDialog";
import { PremiumAnimatedCard } from "@/components/ui/PremiumAnimatedCard";
import { Check, Zap } from "lucide-react";

type PlanId = "free" | "pro" | "business" | "enterprise";

interface Plan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  tagline: string;
  credits: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    tagline: "Discover what you can build for free.",
    credits: "5 credits / day",
    features: ["Workspace-private projects", "Unlimited collaborators", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$25",
    period: "/month",
    tagline: "For fast-moving teams building together.",
    credits: "Higher daily credit limit",
    features: ["All Free features", "Per-member credit limits", "Custom domains", "Email support"],
  },
  {
    id: "business",
    name: "Business",
    price: "$50",
    period: "/month",
    tagline: "Advanced controls for growing teams.",
    credits: "Higher daily credit limit",
    features: ["All Pro features", "Groups & role-based access", "SSO", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For large orgs needing scale and governance.",
    credits: "Volume-based credits",
    features: ["All Business features", "Dedicated support", "Audit logs", "SCIM"],
  },
];

export default function PlansSection() {
  const { user } = useAuth();
  const [creditsRemaining, setCreditsRemaining] = useState<number>();
  const [creditsLimit, setCreditsLimit] = useState<number>();
  const [upgradePlan, setUpgradePlan] = useState<"pro" | "business" | "enterprise" | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchProfileCredits(user.id)
      .then((c) => { setCreditsRemaining(c.credits_remaining); setCreditsLimit(c.credits_daily_limit); })
      .catch(() => {});
  }, [user?.id]);

  const currentPlan: PlanId = "free";

  return (
    <div className="space-y-5">
      <SettingsCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Current plan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Free — Pro billing isn't live yet</p>
          </div>
          <PremiumAnimatedCard radiusClassName="rounded-md">
            <Button onClick={() => setUpgradePlan("pro")} className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Upgrade to Pro
            </Button>
          </PremiumAnimatedCard>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Daily credits</span>
            <span className="text-sm font-semibold text-blue-600">
              {creditsRemaining ?? "-"} / {creditsLimit ?? "-"} left
            </span>
          </div>
          <Progress
            value={creditsLimit ? Math.max(0, Math.min(100, ((creditsRemaining ?? 0) / creditsLimit) * 100)) : 0}
            className="h-1.5 bg-gray-200 [&>div]:bg-blue-600"
          />
          <p className="text-xs text-gray-400 mt-1.5">Credits reset every 24 hours.</p>
        </div>
      </SettingsCard>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <SettingsCard
                key={plan.id}
                className={`flex flex-col ${isCurrent ? "ring-2 ring-blue-600" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">{plan.name}</h4>
                  {isCurrent && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3 min-h-[2rem]">{plan.tagline}</p>
                <div className="mb-3">
                  <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-xs text-gray-400">{plan.period}</span>}
                </div>
                <p className="text-xs font-medium text-gray-700 mb-3">{plan.credits}</p>
                <ul className="space-y-1.5 mb-4 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-gray-500">
                      <Check className="h-3 w-3 text-blue-600 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button disabled variant="outline" className="w-full border-gray-200 text-gray-400">
                    Current plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => setUpgradePlan(plan.id as "pro" | "business" | "enterprise")}
                    variant="outline"
                    className="w-full border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    {plan.id === "enterprise" ? "Contact sales" : "Join waitlist"}
                  </Button>
                )}
              </SettingsCard>
            );
          })}
        </div>
      </div>

      <UpgradeDialog
        open={upgradePlan !== null}
        onClose={() => setUpgradePlan(null)}
        plan={upgradePlan ?? "pro"}
        light
      />
    </div>
  );
}
