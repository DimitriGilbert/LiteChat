// src/components/lite-chat/prompt/prompt-settings-advanced.tsx
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useVfsStore } from "@/store/vfs.store";

// Import the new tab components
import { ParametersTab } from "./advanced-settings-tabs/parameters-tab";
import { SystemPromptTab } from "./advanced-settings-tabs/system-prompt-tab";
import { ApiKeysTab } from "./advanced-settings-tabs/api-keys-tab";
import { FilesTab } from "./advanced-settings-tabs/files-tab";

const PromptSettingsAdvancedComponent: React.FC<{
  className?: string;
  initialTab?: string;
}> = ({ className, initialTab = "parameters" }) => {
  // Fetch only flags needed for conditional rendering of tabs
  const { enableAdvancedSettings } = useSettingsStore(
    useShallow((state) => ({
      enableAdvancedSettings: state.enableAdvancedSettings,
    })),
  );

  const { enableApiKeyManagement } = useProviderStore(
    useShallow((state) => ({
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );

  const { isVfsEnabledForItem } = useVfsStore(
    useShallow((state) => ({
      isVfsEnabledForItem: state.isVfsEnabledForItem,
    })),
  );

  // Ensure advanced settings are enabled before rendering anything
  if (!enableAdvancedSettings) {
    return null;
  }

  return (
    <div className={cn("p-3", className)}>
      <Tabs defaultValue={initialTab} key={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9 mb-3">
          <TabsTrigger value="parameters" className="text-xs px-2 h-7">
            Parameters
          </TabsTrigger>
          <TabsTrigger value="system_prompt" className="text-xs px-2 h-7">
            System Prompt
          </TabsTrigger>
          {enableApiKeyManagement && (
            <TabsTrigger value="api_keys" className="text-xs px-2 h-7">
              API Keys
            </TabsTrigger>
          )}
          <TabsTrigger
            value="files"
            className="text-xs px-2 h-7"
            disabled={!isVfsEnabledForItem}
          >
            Files
          </TabsTrigger>
        </TabsList>

        {/* Parameters Tab */}
        <TabsContent value="parameters">
          <ParametersTab />
        </TabsContent>

        {/* System Prompt Tab */}
        <TabsContent value="system_prompt">
          <SystemPromptTab />
        </TabsContent>

        {/* API Keys Tab */}
        {enableApiKeyManagement && (
          <TabsContent value="api_keys">
            <ApiKeysTab />
          </TabsContent>
        )}

        {/* Files Tab */}
        <TabsContent value="files">
          <FilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const PromptSettingsAdvanced = React.memo(
  PromptSettingsAdvancedComponent,
);
