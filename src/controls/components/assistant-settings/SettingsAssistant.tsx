// src/controls/components/assistant-settings/SettingsAssistant.tsx
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
import { SettingsAssistantPrompt } from "./SettingsAssistantPrompt";
import { SettingsAssistantParameters } from "./SettingsAssistantParameters";
import { SettingsAssistantTools } from "./SettingsAssistantTools";
import { SettingsAssistantTitles } from "./SettingsAssistantTitles";
import { SettingsAssistantPrompts } from "./SettingsAssistantPrompts";
import { SettingsAssistantMcp } from "./SettingsAssistantMcp";

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
        value: "mcp",
        label: "MCP",
        content: <SettingsAssistantMcp />,
      },
      {
        value: "titles",
        label: "Auto-Titles",
        content: <SettingsAssistantTitles />,
      },
      {
        value: "prompts",
        label: "Prompts",
        content: <SettingsAssistantPrompts />,
      },
    ],
    []
  );

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
      {/* Reset Button Section */}
      <Separator className="mt-auto" />
      <div className="flex justify-end pt-3 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={handleResetClick}>
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset All Assistant Settings
        </Button>
      </div>
    </div>
  );
};

export const SettingsAssistant = React.memo(SettingsAssistantComponent);
