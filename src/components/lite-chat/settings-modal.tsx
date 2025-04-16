// src/components/lite-chat/settings-modal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SettingsGeneral } from "./settings-general";
import { SettingsAssistant } from "./settings-assistant";
import { SettingsApiKeys } from "./settings-api-keys";
import { SettingsDataManagement } from "./settings-data-management";
import { SettingsMods } from "./settings-mods";
import { SettingsProviders } from "./settings-providers"; // Import Providers settings tab
import { useChatContext } from "@/hooks/use-chat-context";
import type { CustomSettingTab } from "@/lib/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const context = useChatContext();

  // Use the callback from context to handle open/close changes
  const handleOpenChange = (open: boolean) => {
    context.onSettingsModalOpenChange(open); // Notify context for event emission
    if (!open) {
      onClose(); // Call the original onClose passed via props
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage application settings, AI behavior, API keys, providers, and
            data.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <Tabs defaultValue="general" className="h-full flex flex-col">
            <TabsList className="flex-shrink-0">
              <TabsTrigger value="general">General</TabsTrigger>
              {/* Add Providers Tab Trigger */}
              <TabsTrigger value="providers">Providers</TabsTrigger>
              {context.enableAdvancedSettings && (
                <TabsTrigger value="assistant">Assistant</TabsTrigger>
              )}
              {context.enableApiKeyManagement && (
                <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
              )}
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="mods">Mods</TabsTrigger>
              {/* Add Custom Tab Triggers */}
              {context.customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex-grow overflow-y-auto py-4 pr-2">
              <TabsContent value="general">
                <SettingsGeneral />
              </TabsContent>
              {/* Add Providers Tab Content */}
              <TabsContent value="providers">
                <SettingsProviders />
              </TabsContent>
              {context.enableAdvancedSettings && (
                <TabsContent value="assistant">
                  <SettingsAssistant />
                </TabsContent>
              )}
              {context.enableApiKeyManagement && (
                <TabsContent value="apiKeys">
                  <SettingsApiKeys />
                </TabsContent>
              )}
              <TabsContent value="data">
                <SettingsDataManagement />
              </TabsContent>
              <TabsContent value="mods">
                <SettingsMods />
              </TabsContent>
              {/* Add Custom Tab Content */}
              {context.customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  {/* Render the custom component, passing context */}
                  <tab.component context={context} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
