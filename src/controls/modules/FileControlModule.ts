// src/controls/modules/FileControlModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import { providerEvent } from "@/types/litechat/events/provider.events";
import { inputEvent } from "@/types/litechat/events/input.events";
import { FileControlTrigger } from "@/controls/components/file/FileControlTrigger";
import { FileControlPanel } from "@/controls/components/file/FileControlPanel";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import { toast } from "sonner";
import type { AttachedFileMetadata } from "@/store/input.store";
import { useControlRegistryStore } from "@/store/control.store";
import type { TriggerNamespace, TriggerExecutionContext } from "@/types/litechat/text-triggers";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export class FileControlModule implements ControlModule {
  readonly id = "core-file-attachment";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private modApiRef: LiteChatModApi | null = null;

  private isStreaming = false;
  private modelSupportsNonText = true;
  private attachedFiles: AttachedFileMetadata[] = [];

  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.attachedFiles = useInputStore.getState().attachedFilesMetadata;
    this.updateModelSupport();
    this.notifyComponentUpdate?.();

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (typeof payload === "object" && payload && "status" in payload) {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    });
    const unsubModel = modApi.on(providerEvent.selectedModelChanged, () => {
      this.updateModelSupport();
      this.notifyComponentUpdate?.();
    });
    const unsubFiles = modApi.on(inputEvent.attachedFilesChanged, (payload) => {
      if (typeof payload === "object" && payload && "files" in payload) {
        if (
          JSON.stringify(this.attachedFiles) !== JSON.stringify(payload.files)
        ) {
          this.attachedFiles = payload.files;
          this.notifyComponentUpdate?.();
        }
      }
    });

    this.eventUnsubscribers.push(unsubStatus, unsubModel, unsubFiles);
  }

  private updateModelSupport() {
    const { getSelectedModel } = useProviderStore.getState();
    const selectedModel = getSelectedModel();
    const inputModalities =
      selectedModel?.metadata?.architecture?.input_modalities;
    const newSupport =
      !inputModalities || inputModalities.some((mod) => mod !== "text");
    if (this.modelSupportsNonText !== newSupport) {
      this.modelSupportsNonText = newSupport;
    }
  }

  public getIsStreaming = (): boolean => this.isStreaming;
  public getModelSupportsNonText = (): boolean => this.modelSupportsNonText;
  public getAttachedFiles = (): AttachedFileMetadata[] => this.attachedFiles;
  public isLikelyTextFile = (name: string, type?: string): boolean =>
    isLikelyTextFile(name, type);

  public onFileAdd = (fileData: Omit<AttachedFileMetadata, "id">) => {
    if (fileData.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        `File "${fileData.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`
      );
      return;
    }
    const isText = isLikelyTextFile(fileData.name, fileData.type);
    if (!isText && !this.modelSupportsNonText) {
      toast.warning(
        `File "${fileData.name}" (${fileData.type}) cannot be uploaded. The current model only supports text input.`
      );
      return;
    }
    this.modApiRef?.emit(inputEvent.addAttachedFileRequest, fileData);
  };

  public onFileRemove = (attachmentId: string) => {
    this.modApiRef?.emit(inputEvent.removeAttachedFileRequest, {
      attachmentId,
    });
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    // Register text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().registerTextTriggerNamespace(namespace);
    });

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      triggerRenderer: () =>
        React.createElement(FileControlTrigger, { module: this }),
      renderer: () => React.createElement(FileControlPanel, { module: this }),
    });
  }

  getTextTriggerNamespaces(): TriggerNamespace[] {
    return [{
      id: 'file',
      name: 'File',
      methods: {
        attach: {
          id: 'attach',
          name: 'Attach File',
          description: 'Attach a file from local system',
          argSchema: {
            minArgs: 0,
            maxArgs: 0,
            argTypes: [] as const
          },
          handler: this.handleFileAttach
        }
      },
      moduleId: this.id
    }];
  }

  private handleFileAttach = async (_args: string[], _context: TriggerExecutionContext) => {
    // Trigger file picker (simulate clicking the attach button)
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '*/*';
    fileInput.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files) {
        for (const file of Array.from(files)) {
          let fileData: {
            contentText?: string;
            contentBase64?: string;
          } = {};
          const isText = this.isLikelyTextFile(file.name, file.type);
          const isImage = file.type.startsWith("image/");
          if (isText) {
            fileData.contentText = await file.text();
          } else if (isImage && this.modelSupportsNonText) {
            const reader = new FileReader();
            const promise = new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
            });
            reader.readAsDataURL(file);
            const dataUrl = await promise;
            if (dataUrl && dataUrl.includes(",")) {
              fileData.contentBase64 = dataUrl.split(",")[1];
            }
          }
          this.modApiRef?.emit(inputEvent.addAttachedFileRequest, {
            source: "direct",
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            ...fileData,
          });
        }
      }
    };
    fileInput.click();
  };

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }

    // Unregister text trigger namespaces
    const triggerNamespaces = this.getTextTriggerNamespaces();
    triggerNamespaces.forEach(namespace => {
      useControlRegistryStore.getState().unregisterTextTriggerNamespace(namespace.id);
    });

    this.notifyComponentUpdate = null;
    this.modApiRef = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
