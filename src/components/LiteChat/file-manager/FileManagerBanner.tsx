// src/components/LiteChat/file-manager/FileManagerBanner.tsx
import React from "react";
import { FolderIcon, UsersIcon } from "lucide-react";
import type { SidebarItemType } from "@/types/litechat/chat"
import { useTranslation } from "react-i18next";

interface FileManagerBannerProps {
  vfsKey: string | null;
  selectedItemType: SidebarItemType | null;
}

export const FileManagerBanner: React.FC<FileManagerBannerProps> = ({
  vfsKey,
  selectedItemType,
}) => {
  const { t } = useTranslation('vfs');

  if (vfsKey === "orphan") {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <UsersIcon className="h-4 w-4" />
        <span>
          {t('fileManagerBanner.sharedVfs')}
        </span>
      </div>
    );
  } else if (vfsKey && selectedItemType === "conversation") {
    // This case might be less common now if conversations always inherit project VFS
    return (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <UsersIcon className="h-4 w-4" />
        <span>
          {t('fileManagerBanner.projectSharedVfs')}
        </span>
      </div>
    );
  } else if (vfsKey && selectedItemType === "project") {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <FolderIcon className="h-4 w-4" />
        <span>
          {t('fileManagerBanner.projectVfs')}
        </span>
      </div>
    );
  }

  return null;
};
