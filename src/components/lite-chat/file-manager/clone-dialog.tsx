// src/components/lite-chat/file-manager/clone-dialog.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone Git Repository</DialogTitle>
          <DialogDescription>
            Enter the repository URL. It will be cloned into a new folder named
            after the repository within <code>{currentPath}</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCloning}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmitClone}
            disabled={isCloning || !cloneRepoUrl.trim()}
          >
            {isCloning ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Cloning...
              </>
            ) : (
              "Clone"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
