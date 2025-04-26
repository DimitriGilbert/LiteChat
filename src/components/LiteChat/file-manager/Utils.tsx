// Basic file icon mapping (expand with more icons)
import {
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileQuestion,
  Folder as FolderIcon, // Alias Folder type import
  LucideProps,
} from "lucide-react";

export function getFileIcon(
  mimeTypeOrType: string | undefined | "folder",
  props?: LucideProps,
): React.ReactElement {
  if (mimeTypeOrType === "folder") {
    return <FolderIcon {...props} />;
  }
  if (!mimeTypeOrType) {
    return <FileQuestion {...props} />;
  }
  if (mimeTypeOrType.startsWith("image/")) {
    return <FileImage {...props} />;
  }
  if (mimeTypeOrType.startsWith("audio/")) {
    return <FileAudio {...props} />;
  }
  if (mimeTypeOrType.startsWith("video/")) {
    return <FileVideo {...props} />;
  }
  if (mimeTypeOrType.startsWith("text/")) {
    return <FileText {...props} />;
  }
  if (mimeTypeOrType.includes("zip") || mimeTypeOrType.includes("archive")) {
    return <FileArchive {...props} />;
  }
  return <FileQuestion {...props} />; // Default icon
}
