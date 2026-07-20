// path: src/components/settings/GitSection.tsx
import { useEffect, useState } from "react";
import { getGitHubStatus } from "@/services/github";
import { ConnectGitHubButton } from "@/components/dashboard/GitHubButton";
import SettingsCard from "./SettingsCard";
import { Github } from "lucide-react";

export default function GitSection() {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string>();

  const refresh = () => {
    getGitHubStatus().then(({ connected, username }) => {
      setConnected(connected);
      setUsername(username);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <SettingsCard>
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
            <Github className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">GitHub</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {connected ? `Connected as ${username}` : "Push your generated projects to a repository you own."}
            </p>
          </div>
        </div>
        <ConnectGitHubButton connected={connected} username={username} onStatusChange={refresh} />
      </div>
    </SettingsCard>
  );
}
