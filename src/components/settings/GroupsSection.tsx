// path: src/components/settings/GroupsSection.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import SettingsCard from "./SettingsCard";
import UpgradeDialog from "@/components/dashboard/UpgradeDialog";
import { UsersRound } from "lucide-react";

export default function GroupsSection() {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500 -mt-2">Organise users into groups for easier management.</p>

      <SettingsCard className="flex flex-col items-center text-center py-16 px-6">
        <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-5">
          <UsersRound className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">Organize members with groups</h3>
        <p className="text-sm text-gray-500 max-w-sm mb-6">
          Upgrade to Business to create groups, assign members, and manage access across your workspace.
        </p>
        <Button onClick={() => setUpgradeOpen(true)} className="bg-violet-600 text-white hover:bg-violet-700">
          Upgrade
        </Button>
      </SettingsCard>

      <UpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} plan="business" light />
    </div>
  );
}
