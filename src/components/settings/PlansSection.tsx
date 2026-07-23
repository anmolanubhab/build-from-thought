// path: src/components/settings/PlansSection.tsx
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProfileCredits } from "@/services/db";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import SettingsCard from "./SettingsCard";
import UpgradeDialog from "@/components/dashboard/UpgradeDialog";
import { PremiumAnimatedCard } from "@/components/ui/PremiumAnimatedCard";
import { Zap } from "lucide-react";

export default function PlansSection() {
  const { user } = useAuth();
  const [creditsRemaining, setCreditsRemaining] = useState<number>();
  const [creditsLimit, setCreditsLimit] = useState<number>();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchProfileCredits(user.id)
      .then((c) => { setCreditsRemaining(c.credits_remaining); setCreditsLimit(c.credits_daily_limit); })
      .catch(() => {});
  }, [user?.id]);

  return (
    <div className="space-y-5">
      <SettingsCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Current plan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Free — Pro billing isn't live yet</p>
          </div>
          <PremiumAnimatedCard radiusClassName="rounded-md">
            <Button onClick={() => setUpgradeOpen(true)} className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5">
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

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} light />
    </div>
  );
}
