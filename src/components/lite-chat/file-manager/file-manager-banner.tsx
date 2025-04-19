// src/components/lite-chat/file-manager/file-manager-banner.tsx
import React from "react";
import { FolderIcon, UsersIcon } from "lucide-react";
import type { SidebarItemType } from "@/lib/types";

interface FileManagerBannerProps {
  vfsKey: string | null;
  selectedItemType: SidebarItemType | null;
}

export const FileManagerBanner: React.FC<FileManagerBannerProps> = ({
  vfsKey,
  selectedItemType,
}) => {
  if (vfsKey === "orphan") {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <UsersIcon className="h-4 w-4" />
        <span>
          <b>Shared VFS:</b> All chats <i>not</i> in a project share this
          filesystem.
        </span>
      </div>
    );
  } else if (vfsKey && selectedItemType === "conversation") {
    // This case might be less common now if conversations always inherit project VFS
    return (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <UsersIcon className="h-4 w-4" />
        <span>
          <b>Project-shared VFS:</b> All chats in this project share this
          filesystem.
        </span>
      </div>
    );
  } else if (vfsKey && selectedItemType === "project") {
    return (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <FolderIcon className="h-4 w-4" />
        <span>
          <b>Project VFS:</b> Filesystem for this project and all its chats.
        </span>
      </div>
    );
  }

  return null; // No banner otherwise
};
