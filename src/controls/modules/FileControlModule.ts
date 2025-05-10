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

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export class FileControlModule implements ControlModule {
  readonly id = "core-file-attachment";
  // private modApi: LiteChatModApi | null = null; // Removed as it was unused
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  private isStreaming = false;
  private modelSupportsNonText = true;
  private attachedFiles: AttachedFileMetadata[] = [];

  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    // this.modApi = modApi; // Removed
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.attachedFiles = useInputStore.getState().attachedFilesMetadata;
    this.updateModelSupport();
    this.notifyComponentUpdate?.(); // Notify after initial state load

    const unsubStatus = modApi.on(interactionEvent.statusChanged, (payload) => {
      if (this.isStreaming !== (payload.status === "streaming")) {
        this.isStreaming = payload.status === "streaming";
        this.notifyComponentUpdate?.();
      }
    });
    const unsubModel = modApi.on(providerEvent.modelSelectionChanged, () => {
      this.updateModelSupport();
      this.notifyComponentUpdate?.();
    });
    const unsubFiles = modApi.on(inputEvent.attachedFilesChanged, (payload) => {
      if (
        JSON.stringify(this.attachedFiles) !== JSON.stringify(payload.files)
      ) {
        this.attachedFiles = payload.files;
        this.notifyComponentUpdate?.();
      }
    });

    this.eventUnsubscribers.push(unsubStatus, unsubModel, unsubFiles);
    console.log(`[${this.id}] Initialized.`);
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
    useInputStore.getState().addAttachedFile(fileData);
  };

  public onFileRemove = (attachmentId: string) => {
    useInputStore.getState().removeAttachedFile(attachmentId);
  };

  public setNotifyCallback = (cb: (() => void) | null) => {
    this.notifyComponentUpdate = cb;
  };

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerPromptControl({
      id: this.id,
      triggerRenderer: () =>
        React.createElement(FileControlTrigger, { module: this }),
      renderer: () => React.createElement(FileControlPanel, { module: this }),
    });
    console.log(`[${this.id}] Registered.`);
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    this.notifyComponentUpdate = null;
    // this.modApi = null; // Removed
    console.log(`[${this.id}] Destroyed.`);
  }
}
