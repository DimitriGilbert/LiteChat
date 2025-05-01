// src/components/LiteChat/settings/SettingsGitConfig.tsx
// Entire file content provided
import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { SettingsSection } from "../common/SettingsSection"

const SettingsGitConfigComponent: React.FC = () => {
  const { gitUserName, setGitUserName, gitUserEmail, setGitUserEmail } =
    useSettingsStore(
      useShallow((state) => ({
        gitUserName: state.gitUserName,
        setGitUserName: state.setGitUserName,
        gitUserEmail: state.gitUserEmail,
        setGitUserEmail: state.setGitUserEmail,
      })),
    );

  return (
    <div className="space-y-6 p-1">
      {/* Use SettingsSection */}
      <SettingsSection
        title="Git User Configuration"
        description="Set your user name and email for Git commits made within the VFS. This is required for committing changes."
        contentClassName="rounded-lg border p-4 shadow-sm bg-card" // Apply card styling to content
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="git-user-name">Git User Name</Label>
            <Input
              id="git-user-name"
              value={gitUserName ?? ""}
              onChange={(e) => setGitUserName(e.target.value)}
              placeholder="Your Name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="git-user-email">Git User Email</Label>
            <Input
              id="git-user-email"
              type="email"
              value={gitUserEmail ?? ""}
              onChange={(e) => setGitUserEmail(e.target.value)}
              placeholder="your.email@example.com"
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};

export const SettingsGitConfig = React.memo(SettingsGitConfigComponent);
