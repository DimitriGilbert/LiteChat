// src/components/LiteChat/settings/SettingsRulesAndTags.tsx
// FULL FILE
import React, { useMemo } from "react";
import { SettingsRules } from "./rules/SettingsRules";
import { SettingsTags } from "./tags/SettingsTags";
import { TabbedLayout, TabDefinition } from "../common/TabbedLayout";

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
    [],
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
