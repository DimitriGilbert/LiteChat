// src/controls/components/rules/SettingsRulesAndTags.tsx
// FULL FILE
import React, { useMemo, useEffect, useState } from "react";
import { SettingsRules } from "@/controls/components/rules/SettingsRules";
import { SettingsTags } from "@/controls/components/rules/SettingsTags";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import type { RulesControlModule } from "@/controls/modules/RulesControlModule";

interface SettingsRulesAndTagsProps {
  module: RulesControlModule;
}

export const SettingsRulesAndTags: React.FC<SettingsRulesAndTagsProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifySettingsCallback(() => forceUpdate({}));
    return () => module.setNotifySettingsCallback(null);
  }, [module]);

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "rules",
        label: "Rules",
        content: <SettingsRules module={module} />,
      },
      {
        value: "tags",
        label: "Tags",
        content: <SettingsTags module={module} />,
      },
    ],
    [module]
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
