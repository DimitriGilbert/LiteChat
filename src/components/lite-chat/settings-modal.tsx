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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Add bg-background here */}
      <DialogContent className="sm:max-w-[650px] flex flex-col max-h-[80vh] bg-cyan-950">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage API keys, application settings, and chat data.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="apiKeys"
          className="flex-grow flex flex-col overflow-hidden"
        >
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="assistant">Prompt</TabsTrigger>

            <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
            <TabsTrigger value="data">Data Management</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-grow mt-4 pr-1">
            <TabsContent value="general" className="mt-0">
              <SettingsGeneral />
            </TabsContent>
            <TabsContent value="assistant">
              <SettingsAssistant />
            </TabsContent>
            <TabsContent value="apiKeys" className="mt-0">
              <SettingsApiKeys />
            </TabsContent>
            <TabsContent value="data" className="mt-0">
              <SettingsDataManagement />
            </TabsContent>
          </ScrollArea>
        </Tabs>
        {/* Optional Footer */}
        {/* <DialogFooter className="mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
};
