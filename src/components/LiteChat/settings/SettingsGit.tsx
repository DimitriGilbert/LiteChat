// src/components/LiteChat/settings/SettingsGit.tsx
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsGitConfig } from "./SettingsGitConfig";
import { SettingsGitSyncRepos } from "./SettingsGitSyncRepos";
import { cn } from "@/lib/utils";

const SettingsGitComponent: React.FC = () => {
  // Reusing the tab trigger style from SettingsModal for consistency
  const tabTriggerClass = cn(
    "px-3 py-1.5 text-sm font-medium rounded-md",
    "text-muted-foreground",
    "border border-transparent",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    "data-[state=active]:border-primary",
    "dark:data-[state=active]:bg-primary/20 dark:data-[state=active]:text-primary",
    "dark:data-[state=active]:border-primary/70",
    "hover:bg-muted/50 hover:text-primary/80",
  );

  return (
    <Tabs defaultValue="config" className="flex flex-col h-full">
      <TabsList className="flex-shrink-0 gap-1 p-1">
        <TabsTrigger value="config" className={tabTriggerClass}>
          User Config
        </TabsTrigger>
        <TabsTrigger value="sync" className={tabTriggerClass}>
          Sync Repositories
        </TabsTrigger>
        {/* Add more Git-related tabs here later */}
      </TabsList>
      <div className="flex-grow mt-4 overflow-y-auto">
        <TabsContent value="config">
          <SettingsGitConfig />
        </TabsContent>
        <TabsContent value="sync">
          <SettingsGitSyncRepos />
        </TabsContent>
      </div>
    </Tabs>
  );
};

export const SettingsGit = React.memo(SettingsGitComponent);
