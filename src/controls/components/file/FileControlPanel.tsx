// src/controls/components/file/FileControlPanel.tsx
// NEW FILE
import React, { useState, useEffect } from "react";
import { FilePreviewRenderer } from "@/components/LiteChat/common/FilePreviewRenderer";
import { cn } from "@/lib/utils";
import type { FileControlModule } from "@/controls/modules/FileControlModule"; // Import module type

interface FileControlPanelProps {
  module: FileControlModule;
}

export const FileControlPanel: React.FC<FileControlPanelProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});

  // Read state from module
  const attachedFilesMetadata = module.getAttachedFiles();
  const isStreaming = module.getIsStreaming();

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  if (attachedFilesMetadata.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("max-h-40 overflow-y-auto pr-1", "flex flex-wrap gap-1")}
    >
      {attachedFilesMetadata.map((fileMeta) => (
        <FilePreviewRenderer
          key={fileMeta.id}
          fileMeta={fileMeta}
          onRemove={module.onFileRemove} // Call module method
          isReadOnly={isStreaming}
        />
      ))}
    </div>
  );
};
