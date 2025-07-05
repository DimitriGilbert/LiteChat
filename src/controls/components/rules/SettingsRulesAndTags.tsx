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
import { useTranslation } from "react-i18next";

interface SettingsRulesAndTagsProps {
  module: RulesControlModule;
}

export const SettingsRulesAndTags: React.FC<SettingsRulesAndTagsProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  const { t } = useTranslation('controls');

  useEffect(() => {
    module.setNotifySettingsCallback(() => forceUpdate({}));
    return () => module.setNotifySettingsCallback(null);
  }, [module]);

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "rules",
        label: t('rules'),
        content: <SettingsRules module={module} />,
      },
      {
        value: "tags",
        label: t('tags'),
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
