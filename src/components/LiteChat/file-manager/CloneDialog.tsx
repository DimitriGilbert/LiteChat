// src/components/LiteChat/file-manager/CloneDialog.tsx

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionDialog } from "../common/ActionDialog";

interface CloneDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cloneRepoUrl: string;
  setCloneRepoUrl: (url: string) => void;
  cloneBranch: string;
  setCloneBranch: (branch: string) => void;
  isCloning: boolean;
  onSubmitClone: () => Promise<void>;
  currentPath: string;
}

export const CloneDialog: React.FC<CloneDialogProps> = ({
  isOpen,
  onOpenChange,
  cloneRepoUrl,
  setCloneRepoUrl,
  cloneBranch,
  setCloneBranch,
  isCloning,
  onSubmitClone,
  currentPath,
}) => {
  return (
    <ActionDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Clone Git Repository"
      description={
        <>
          Enter the repository URL. It will be cloned into a new folder named
          after the repository within <code>{currentPath}</code>.
        </>
      }
      submitLabel="Clone"
      onSubmit={onSubmitClone}
      isSubmitting={isCloning}
      submitDisabled={!cloneRepoUrl.trim()}
    >
      {/* Form content goes here as children */}
      <div className="grid gap-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="clone-url" className="text-right">
            URL
          </Label>
          <Input
            id="clone-url"
            value={cloneRepoUrl}
            onChange={(e) => setCloneRepoUrl(e.target.value)}
            className="col-span-3"
            placeholder="https://github.com/user/repo.git"
            disabled={isCloning}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="clone-branch" className="text-right">
            Branch
          </Label>
          <Input
            id="clone-branch"
            value={cloneBranch}
            onChange={(e) => setCloneBranch(e.target.value)}
            className="col-span-3"
            placeholder="main (default)"
            disabled={isCloning}
          />
        </div>
      </div>
    </ActionDialog>
  );
};
