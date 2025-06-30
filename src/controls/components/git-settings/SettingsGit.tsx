// src/components/LiteChat/settings/SettingsGit.tsx

import React, { useMemo } from "react";
import { SettingsGitConfig } from "./SettingsGitConfig";
import { SettingsGitSyncRepos } from "./SettingsGitSyncRepos";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { useTranslation } from "react-i18next";

const SettingsGitComponent: React.FC = () => {
  const { t } = useTranslation('git');
  // Define tabs for the layout
  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "config",
        label: t('settings.userConfigTab', 'User Config'),
        content: <SettingsGitConfig />,
      },
      {
        value: "sync",
        label: t('settings.syncReposTab', 'Sync Repositories'),
        content: <SettingsGitSyncRepos />,
      },
      // Add more Git-related tabs here later if needed
    ],
    [t]
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
