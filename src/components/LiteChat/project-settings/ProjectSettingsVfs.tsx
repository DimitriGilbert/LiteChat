// src/components/LiteChat/settings/ProjectSettingsVfs.tsx
import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";
import { FileManager } from "@/components/LiteChat/file-manager/FileManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { cn } from "@/lib/utils"; // Import cn for styling

interface ProjectSettingsVfsProps {
  projectId: string | null;
  projectName: string | null;
  isSaving: boolean;
}

export const ProjectSettingsVfs: React.FC<ProjectSettingsVfsProps> = ({
  projectId,
  projectName,
  isSaving,
}) => {
  const handleClearVfs = () => {
    toast.info(
      `VFS clearing for project "${projectName}" is not yet implemented.`,
    );
  };

  // Reusing the tab trigger style from SettingsModal for consistency
  const subTabTriggerClass = cn(
    "px-2.5 py-1 text-xs font-medium rounded-md", // Smaller text/padding
    "text-muted-foreground",
    "border border-transparent",
    "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1", // Adjusted focus ring
    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
    "data-[state=active]:border-primary/50", // Slightly lighter border
    "dark:data-[state=active]:bg-primary/20 dark:data-[state=active]:text-primary",
    "dark:data-[state=active]:border-primary/70",
    "hover:bg-muted/50 hover:text-primary/80",
  );

  return (
    // Use flex-col and h-full to allow Tabs to take space
    <div className="flex flex-col h-full">
      <Tabs defaultValue="manage" className="flex-grow flex flex-col">
        <TabsList className="flex-shrink-0 gap-1 p-1 mb-3 h-auto justify-start bg-muted/50 rounded-md">
          <TabsTrigger value="manage" className={subTabTriggerClass}>
            Manage Files
          </TabsTrigger>
          <TabsTrigger value="settings" className={subTabTriggerClass}>
            Settings & Danger Zone
          </TabsTrigger>
        </TabsList>

        {/* Content for "Manage Files" tab */}
        <TabsContent
          value="manage"
          className="flex-grow flex flex-col overflow-hidden data-[state=inactive]:hidden" // Ensure inactive tabs don't affect layout
        >
          <div className="flex-grow border rounded-md overflow-hidden">
            {projectId ? (
              <FileManager />
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Invalid Project ID. Cannot load filesystem.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Content for "Settings" tab */}
        <TabsContent
          value="settings"
          className="space-y-4 data-[state=inactive]:hidden" // Ensure inactive tabs don't affect layout
        >
          <div>
            <Label>Project Filesystem Info</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Each project has its own dedicated Virtual File System (VFS).
            </p>
            <div className="p-3 border rounded bg-muted/30 text-sm mb-2">
              <p>
                <span className="font-medium">Project ID (VFS Key):</span>{" "}
                <code className="text-xs">{projectId || "N/A"}</code>
              </p>
            </div>
          </div>

          <div className="border-t pt-4 border-destructive/50 mt-4 flex-shrink-0">
            <Label className="text-destructive">Danger Zone</Label>
            <p className="text-xs text-destructive/90 mb-2">
              Clearing the VFS will permanently delete all files stored
              specifically for this project. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearVfs}
              disabled={isSaving || !projectId}
            >
              <AlertCircleIcon className="h-4 w-4 mr-1" />
              Clear Project VFS (Not Implemented)
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
