// src/components/lite-chat/settings-modal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SettingsGeneral } from "./settings-general";
import { SettingsApiKeys } from "./settings-api-keys";
import { SettingsDataManagement } from "./settings-data-management";
import { SettingsAssistant } from "./settings-assistant";
import { useChatContext } from "@/hooks/use-chat-context"; // <-- Import context hook

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { enableApiKeyManagement } = useChatContext(); // <-- Get flag

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] flex flex-col max-h-[80vh] bg-cyan-950">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage API keys, application settings, and chat data.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          // Default to 'general' if API keys are disabled, otherwise 'apiKeys'
          defaultValue={enableApiKeyManagement ? "apiKeys" : "general"}
          className="flex-grow flex flex-col overflow-hidden"
        >
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="assistant">Prompt</TabsTrigger>
            {/* Conditionally render API Keys trigger */}
            {enableApiKeyManagement && (
              <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
            )}
            <TabsTrigger value="data">Data Management</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-grow mt-4 pr-1">
            <TabsContent value="general" className="mt-0">
              <SettingsGeneral />
            </TabsContent>
            <TabsContent value="assistant">
              <SettingsAssistant />
            </TabsContent>
            {/* Conditionally render API Keys content */}
            {enableApiKeyManagement && (
              <TabsContent value="apiKeys" className="mt-0">
                <SettingsApiKeys />
              </TabsContent>
            )}
            <TabsContent value="data" className="mt-0">
              <SettingsDataManagement />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
