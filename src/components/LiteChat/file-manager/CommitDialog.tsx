// src/components/LiteChat/file-manager/CommitDialog.tsx

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionDialog } from "@/components/LiteChat/common/ActionDialog";

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
    <ActionDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Commit Changes"
      description={
        <>
          Enter a commit message for the changes in <code>{commitPath}</code>.
          All current changes in this directory will be staged and committed.
        </>
      }
      submitLabel="Commit"
      onSubmit={onSubmitCommit}
      isSubmitting={isCommitting}
      submitDisabled={!commitMessage.trim()}
    >
      {/* Form content goes here as children */}
      <div className="grid gap-4">
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
    </ActionDialog>
  );
};
