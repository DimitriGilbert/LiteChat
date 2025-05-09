// src/components/LiteChat/project-settings/ProjectSettingsVfs.tsx

import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
// import { Button } from "@/components/ui/button";
// import { AlertCircleIcon } from "lucide-react";
// import { toast } from "sonner";
import { FileManager } from "@/components/LiteChat/file-manager/FileManager";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { cn } from "@/lib/utils";

interface ProjectSettingsVfsProps {
  projectId: string | null;
  projectName: string | null;
  isSaving: boolean;
}

export const ProjectSettingsVfs: React.FC<ProjectSettingsVfsProps> = ({
  projectId,
  // isSaving,
}) => {
  // const handleClearVfs = () => {
  //   toast.info(
  //     `VFS clearing for project "${projectName}" is not yet implemented.`,
  //   );
  // };

  // Define tabs for the layout
  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "manage",
        label: "Manage Files",
        content: (
          // Ensure FileManager container allows it to fill height
          <div className="flex-grow border rounded-md overflow-hidden h-full">
            {projectId ? (
              <FileManager />
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Invalid Project ID. Cannot load filesystem.
              </div>
            )}
          </div>
        ),
      },
      {
        value: "settings",
        label: "Settings",
        content: (
          <div className="space-y-4">
            <div>
              <Label>Project Filesystem Info</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Each project has its own dedicated Virtual File System (VFS).
              </p>
              <div className="p-3 border rounded bg-muted/30 text-sm mb-2 break-all">
                {" "}
                {/* Added break-all */}
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
              {/* <Button
                variant="destructive"
                size="sm"
                onClick={()=>{}}
                disabled={isSaving || !projectId}
              >
                <AlertCircleIcon className="h-4 w-4 mr-1" />
                Clear Project VFS (Not Implemented)
              </Button> */}
            </div>
          </div>
        ),
      },
    ],
    [projectId]
  );

  return (
    // Use TabbedLayout, remove internal Tabs component
    <TabbedLayout
      tabs={tabs}
      defaultValue="manage"
      className="h-full flex flex-col" // Ensure it fills height and uses flex-col
      listClassName={cn(
        "bg-muted/50 rounded-md",
        "flex-wrap justify-start h-auto",
        "p-1 gap-1"
      )}
      contentContainerClassName="mt-3 flex-grow flex flex-col overflow-y-auto" // Ensure content area grows and scrolls
    />
  );
};
