// src/components/LiteChat/settings/SettingsGit.tsx

import React, { useMemo } from "react";
import { SettingsGitConfig } from "./SettingsGitConfig";
import { SettingsGitSyncRepos } from "./SettingsGitSyncRepos";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";

const SettingsGitComponent: React.FC = () => {
  // Define tabs for the layout
  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "config",
        label: "User Config",
        content: <SettingsGitConfig />,
      },
      {
        value: "sync",
        label: "Sync Repositories",
        content: <SettingsGitSyncRepos />,
      },
      // Add more Git-related tabs here later if needed
    ],
    []
  );

  return (
    // Use TabbedLayout, remove internal Tabs component
    <TabbedLayout
      tabs={tabs}
      defaultValue="config"
      className="h-full" // Ensure it fills height if needed by parent
      listClassName="bg-muted/50 rounded-md" // Example custom list style
      contentContainerClassName="mt-4" // Add margin top to content
    />
  );
};

export const SettingsGit = React.memo(SettingsGitComponent);
