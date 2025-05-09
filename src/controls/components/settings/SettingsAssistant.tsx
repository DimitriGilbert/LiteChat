// src/components/LiteChat/settings/SettingsAssistant.tsx
// FULL FILE
import React, { useMemo } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { SettingsAssistantPrompt } from "@/controls/components/assitant/SettingsAssistantPrompt";
import { SettingsAssistantParameters } from "@/controls/components/assitant/SettingsAssistantParameters";
import { SettingsAssistantTools } from "@/controls/components/assitant/SettingsAssistantTools";
import { SettingsAssistantTitles } from "@/controls/components/assitant/SettingsAssistantTitles";

const SettingsAssistantComponent: React.FC = () => {
  const { resetAssistantSettings } = useSettingsStore(
    useShallow((state) => ({
      resetAssistantSettings: state.resetAssistantSettings,
    }))
  );

  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all Assistant settings (Prompt, Parameters, Tools, Auto-Title) to their defaults?"
      )
    ) {
      resetAssistantSettings();
    }
  };

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "prompt",
        label: "System Prompt",
        content: <SettingsAssistantPrompt />,
      },
      {
        value: "parameters",
        label: "Parameters",
        content: <SettingsAssistantParameters />,
      },
      {
        value: "tools",
        label: "Tools",
        content: <SettingsAssistantTools />,
      },
      {
        value: "titles",
        label: "Auto-Titles",
        content: <SettingsAssistantTitles />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6 p-1 h-full flex flex-col">
      <TabbedLayout
        tabs={tabs}
        defaultValue="prompt"
        className="flex-grow"
        listClassName="bg-muted/50 rounded-md"
        contentContainerClassName="mt-4"
      />
      {/* Reset Button Section */}
      <Separator className="mt-auto" />
      <div className="flex justify-end pt-4 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={handleResetClick}>
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset All Assistant Settings
        </Button>
      </div>
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
