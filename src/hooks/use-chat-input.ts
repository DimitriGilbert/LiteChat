// src/hooks/use-chat-input.ts
import { useState, useCallback } from "react";

interface UseChatInputReturn {
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  attachedFiles: File[];
  addAttachedFile: (file: File) => void;
  removeAttachedFile: (fileName: string) => void;
  clearAttachedFiles: () => void;
}

export function useChatInput(): UseChatInputReturn {
  const [prompt, setPrompt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const addAttachedFile = useCallback((file: File) => {
    setAttachedFiles((prev) => [...prev, file]);
    // TODO: Add validation (size, type) if needed
  }, []);

  const removeAttachedFile = useCallback((fileName: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  return {
    prompt,
    setPrompt,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
  };
}
