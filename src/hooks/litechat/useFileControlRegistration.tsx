// src/hooks/litechat/useFileControlRegistration.tsx
import React, { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useInputStore } from "@/store/input.store";
import type { PromptControl } from "@/types/litechat/prompt";
import { toast } from "sonner";
import { COMMON_TEXT_EXTENSIONS_VFS } from "@/types/litechat/vfs";

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const base64Content = reader.result.split(",")[1];
        if (base64Content) {
          resolve(base64Content);
        } else {
          reject(new Error("Failed to extract base64 content from data URL."));
        }
      } else {
        reject(new Error("FileReader result is not a string."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader result is not a string."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

export const useFileControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const addAttachedFile = useInputStore((state) => state.addAttachedFile);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        const processingPromises = Array.from(files).map(async (file) => {
          try {
            const mimeType = file.type || "application/octet-stream";
            const fileNameLower = file.name.toLowerCase();
            const isText =
              mimeType.startsWith("text/") ||
              mimeType === "application/json" ||
              COMMON_TEXT_EXTENSIONS_VFS.some((ext) =>
                fileNameLower.endsWith(ext),
              );

            if (isText) {
              const textContent = await readFileAsText(file);
              addAttachedFile({
                source: "direct",
                name: file.name,
                type: mimeType,
                size: file.size,
                contentText: textContent,
              });
            } else {
              const base64Content = await readFileAsBase64(file);
              addAttachedFile({
                source: "direct",
                name: file.name,
                type: mimeType,
                size: file.size,
                contentBase64: base64Content,
              });
            }
          } catch (error) {
            console.error(`Error reading file ${file.name}:`, error);
            toast.error(
              `Failed to read file "${file.name}": ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        });

        await Promise.all(processingPromises);

        if (event.target) {
          event.target.value = "";
        }
      }
    },
    [addAttachedFile],
  );

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-file-control",
      triggerRenderer: () => (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAttachClick}
            className="h-10 w-10 rounded-full"
            aria-label="Attach file(s)"
          >
            <PaperclipIcon className="h-5 w-5" />
          </Button>
        </>
      ),
      show: () => true,
      order: 30,
    };

    const unregister = register(control);
    return unregister;
  }, [register, addAttachedFile, handleAttachClick, handleFileChange]);

  return null;
};
