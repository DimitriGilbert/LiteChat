// src/components/LiteChat/settings/SettingsRulesAndTags.tsx
// FULL FILE
import React, { useMemo } from "react";
import { SettingsRules } from "@/controls/components/rules/SettingsRules";
import { SettingsTags } from "@/controls/components/rules/SettingsTags";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";

export const SettingsRulesAndTags: React.FC = () => {
  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "rules",
        label: "Rules",
        content: <SettingsRules />,
      },
      {
        value: "tags",
        label: "Tags",
        content: <SettingsTags />,
      },
    ],
    []
  );

  return (
    <TabbedLayout
      tabs={tabs}
      defaultValue="rules"
      className="h-full"
      listClassName="bg-muted/50 rounded-md"
      contentContainerClassName="mt-4"
    />
  );
};
