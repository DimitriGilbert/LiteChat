// src/controls/components/assistant-settings/SettingsAssistant.tsx
// FULL FILE
import React, { useMemo } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
// import { Separator } from "@/components/ui/separator";
// import { Button } from "@/components/ui/button";
// import { RotateCcwIcon } from "lucide-react";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { SettingsAssistantPrompt } from "./SettingsAssistantPrompt";
import { SettingsAssistantParameters } from "./SettingsAssistantParameters";
import { SettingsAssistantTools } from "./SettingsAssistantTools";
import { SettingsAssistantTitles } from "./SettingsAssistantTitles";
import { SettingsAssistantPrompts } from "./SettingsAssistantPrompts";
import { SettingsAssistantAgent } from "./SettingsAssistantAgent";
import { SettingsAssistantMcp } from "./SettingsAssistantMcp";
import { SettingsAssistantForkCompact } from "./SettingsAssistantForkCompact";
import { useTranslation } from "react-i18next";

const SettingsAssistantComponent: React.FC = () => {
  const { t } = useTranslation('assistantSettings');

  const { enableAdvancedSettings } = useSettingsStore(
    useShallow((state) => ({
      enableAdvancedSettings: state.enableAdvancedSettings,
    }))
  );

  const tabs: TabDefinition[] = useMemo(() => {
    const allTabs: TabDefinition[] = [
      {
        value: "prompt",
        label: t('assistantTabs.systemPrompt'),
        content: <SettingsAssistantPrompt />,
      },
      {
        value: "library",
        label: t('assistantTabs.library'),
        content: <SettingsAssistantPrompts />,
      },
      {
        value: "agents",
        label: t('assistantTabs.agents'),
        content: <SettingsAssistantAgent />,
      },
      {
        value: "titles",
        label: t('assistantTabs.autoTitles'),
        content: <SettingsAssistantTitles />,
      },
      {
        value: "tools",
        label: t('assistantTabs.tools'),
        content: <SettingsAssistantTools />,
      },
    ];

    // Add advanced tabs only when advanced settings is enabled
    if (enableAdvancedSettings) {
      allTabs.push({
          value: "mcp",
          label: t('assistantTabs.mcp'),
          content: <SettingsAssistantMcp />,
        },
        {
          value: "parameters",
          label: t('assistantTabs.parameters'),
          content: <SettingsAssistantParameters />,
        },
        {
          value: "fork-compact",
          label: t('assistantTabs.forkCompact'),
          content: <SettingsAssistantForkCompact />,
        }
      );
    }

    return allTabs;
  }, [enableAdvancedSettings, t]);

  return (
    <div className="space-y-4 p-1 h-full flex flex-col">
      <TabbedLayout
        tabs={tabs}
        defaultValue="prompt"
        className="flex-grow" // Ensure TabbedLayout itself can grow
        listClassName="bg-muted/50 rounded-md"
        contentContainerClassName="mt-3" // No flex-grow, no overflow
        scrollable={false} // Explicitly enable ScrollArea for content
      />
      {/* Reset Button Section, this fucks up the whole thing, appears in the middle of forms and shit ! */}
      {/* <Separator className="mt-auto" />
      <div className="flex justify-end pt-3 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={handleResetClick}>
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset All Assistant Settings
        </Button>
      </div> */}
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
