
import { useState, useCallback, useMemo } from "react";

interface UseChatInputReturn {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  // For temporary uploads before sending
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
  // For including existing VFS files in the next prompt context
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
}

export function useChatInput(): UseChatInputReturn {
  const [prompt, setPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [selectedVfsPaths, setSelectedVfsPaths] = useState<string[]>([]);

  // --- Temporary Uploads ---
  const addAttachedFile = useCallback((file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
  }, []);

  const removeAttachedFile = useCallback((fileName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  // --- VFS Context Selection ---
  const addSelectedVfsPath = useCallback((path: string) => {
    setSelectedVfsPaths((prev) =>
      prev.includes(path) ? prev : [...prev, path].sort(),
    );
  }, []);

  const removeSelectedVfsPath = useCallback((path: string) => {
    setSelectedVfsPaths((prev) => prev.filter((p) => p !== path));
  }, []);

  const clearSelectedVfsPaths = useCallback(() => {
    setSelectedVfsPaths([]);
  }, []);

  return useMemo(
    () => ({
      prompt,
      setPrompt,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
    }),
    [
      prompt,
      setPrompt,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
    ],
  );
}
