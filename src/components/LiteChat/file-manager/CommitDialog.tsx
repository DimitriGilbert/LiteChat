// src/components/LiteChat/file-manager/CommitDialog.tsx
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

interface CommitDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  commitPath: string | null;
  commitMessage: string;
  setCommitMessage: (message: string) => void;
  isCommitting: boolean;
  onSubmitCommit: () => Promise<void>;
}

export const CommitDialog: React.FC<CommitDialogProps> = ({
  isOpen,
  onOpenChange,
  commitPath,
  commitMessage,
  setCommitMessage,
  isCommitting,
  onSubmitCommit,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
          <DialogDescription>
            Enter a commit message for the changes in <code>{commitPath}</code>.
            All current changes in this directory will be staged and committed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="commit-msg" className="text-right">
              Message
            </Label>
            <Input
              id="commit-msg"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Add feature X"
              disabled={isCommitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCommitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmitCommit}
            disabled={isCommitting || !commitMessage.trim()}
          >
            {isCommitting ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Committing...
              </>
            ) : (
              "Commit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
