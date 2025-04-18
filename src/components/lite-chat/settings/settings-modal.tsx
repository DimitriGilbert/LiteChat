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
import { SettingsProviders } from "./settings-providers";
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

  const handleOpenChange = (open: boolean) => {
    context.onSettingsModalOpenChange(open);
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* Increased max-width and height for larger screens */}
      <DialogContent className="sm:max-w-[1200px] w-[90vw] h-[80vh] min-h-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage application settings, AI behavior, API keys, providers, and
            data.
          </DialogDescription>
        </DialogHeader>

        {/* This div grows and handles scrolling for the content */}
        <div className="flex-grow overflow-y-auto py-4 pr-2">
          {/* Remove height/flex constraints from Tabs */}
          <Tabs defaultValue="general">
            <TabsList className="flex-shrink-0 sticky top-0 bg-background z-10 mb-4 flex-wrap h-auto justify-start">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="providers">Providers</TabsTrigger>
              {context.enableAdvancedSettings && (
                <TabsTrigger value="assistant">Assistant</TabsTrigger>
              )}
              {context.enableApiKeyManagement && (
                <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
              )}
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="mods">Mods</TabsTrigger>
              {/* Mod-added tabs rendering logic (seems correct) */}
              {context.customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Content area - removed mt-4 to be closer to tabs */}
            <div>
              <TabsContent value="general">
                <SettingsGeneral />
              </TabsContent>
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
              {/* Mod-added tab content rendering logic (seems correct) */}
              {context.customSettingsTabs.map((tab: CustomSettingTab) => (
                <TabsContent key={tab.id} value={tab.id}>
                  <tab.component context={context} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
