// src/components/LiteChat/file-manager/CloneDialog.tsx

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionDialog } from "@/components/LiteChat/common/ActionDialog";
import { InfoIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

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

// Helper function to show HTTPS recommendation for SSH URLs
const getRepositoryHelpText = (repoUrl: string, t: (key: string) => string) => {
  if (repoUrl.startsWith('git@') || repoUrl.includes('ssh://')) {
    return (
      <div className="text-sm text-amber-600 mt-1 flex items-center gap-1">
        <InfoIcon className="h-4 w-4" aria-label={t('git:infoAriaLabel')} aria-hidden="true" />
        {t('git:cloneDialog.httpsRecommendation')}
      </div>
    );
  }
  return null;
};

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
  const { t } = useTranslation('git');

  return (
    <ActionDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={t('cloneDialog.title')}
      description={
        <>
          {t('cloneDialog.description', { currentPath })}
        </>
      }
      submitLabel={t('cloneDialog.cloneButton')}
      onSubmit={onSubmitClone}
      isSubmitting={isCloning}
      submitDisabled={!cloneRepoUrl.trim()}
    >
      {/* Form content goes here as children */}
      <div className="grid gap-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="clone-url" className="text-right">
            {t('cloneDialog.urlLabel')}
          </Label>
          <div className="col-span-3">
            <Input
              id="clone-url"
              value={cloneRepoUrl}
              onChange={(e) => setCloneRepoUrl(e.target.value)}
              placeholder={t('cloneDialog.urlPlaceholder')}
              disabled={isCloning}
            />
            {getRepositoryHelpText(cloneRepoUrl, t)}
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="clone-branch" className="text-right">
            {t('cloneDialog.branchLabel')}
          </Label>
          <Input
            id="clone-branch"
            value={cloneBranch}
            onChange={(e) => setCloneBranch(e.target.value)}
            className="col-span-3"
            placeholder={t('cloneDialog.branchPlaceholder')}
            disabled={isCloning}
          />
        </div>
      </div>
    </ActionDialog>
  );
};
