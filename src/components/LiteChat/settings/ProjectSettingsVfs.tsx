// src/components/LiteChat/settings/ProjectSettingsVfs.tsx
// NEW FILE
import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

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
    // TODO: Implement VFS clearing logic
    // This would likely involve:
    // 1. Getting the VFS key associated with the project (e.g., projectId itself)
    // 2. Calling a VFS operation to clear the contents for that key
    // 3. Providing appropriate confirmation dialogs
    toast.info(
      `VFS clearing for project "${projectName}" is not yet implemented.`,
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Project Filesystem (VFS)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Each project has its own dedicated Virtual File System (VFS) stored in
          your browser's IndexedDB. Files attached from the VFS within this
          project's conversations are referenced from here.
        </p>
        <div className="p-3 border rounded bg-muted/30 text-sm">
          <p>
            <span className="font-medium">Project ID (VFS Key):</span>{" "}
            <code className="text-xs">{projectId || "N/A"}</code>
          </p>
          {/* Add more VFS info here later if needed (e.g., size estimate) */}
        </div>
      </div>
      <div className="border-t pt-4 border-destructive/50">
        <Label className="text-destructive">Danger Zone</Label>
        <p className="text-xs text-destructive/90 mb-2">
          Clearing the VFS will permanently delete all files stored specifically
          for this project. This cannot be undone.
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
    </div>
  );
};
