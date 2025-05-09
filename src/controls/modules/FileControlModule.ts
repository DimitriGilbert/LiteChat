// src/controls/modules/FileControlModule.ts
// FULL FILE
import React from "react";
// Corrected: Import ControlModule from its definition file
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  InteractionEvent,
  ProviderEvent,
  InputEvent,
} from "@/types/litechat/modding";
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
  // @ts-expect-error - ts have not seeing it is used, keep it for now (Pattern 4)
  private modApi: LiteChatModApi | null = null;
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];

  private isStreaming = false;
  private modelSupportsNonText = true;
  private attachedFiles: AttachedFileMetadata[] = [];

  private notifyComponentUpdate: (() => void) | null = null;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApi = modApi;
    this.isStreaming = useInteractionStore.getState().status === "streaming";
    this.attachedFiles = useInputStore.getState().attachedFilesMetadata;
    this.updateModelSupport();

    const unsubStatus = modApi.on(
      InteractionEvent.STATUS_CHANGED,
      (payload) => {
        if (this.isStreaming !== (payload.status === "streaming")) {
          this.isStreaming = payload.status === "streaming";
          this.notifyComponentUpdate?.();
        }
      }
    );
    const unsubModel = modApi.on(ProviderEvent.MODEL_SELECTION_CHANGED, () => {
      this.updateModelSupport();
      this.notifyComponentUpdate?.();
    });
    const unsubFiles = modApi.on(
      InputEvent.ATTACHED_FILES_CHANGED,
      (payload) => {
        // Ensure we're comparing values correctly or just update
        if (
          JSON.stringify(this.attachedFiles) !== JSON.stringify(payload.files)
        ) {
          this.attachedFiles = payload.files;
          this.notifyComponentUpdate?.();
        }
      }
    );

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

  // Getters for components
  public getIsStreaming = (): boolean => this.isStreaming;
  public getModelSupportsNonText = (): boolean => this.modelSupportsNonText;
  public getAttachedFiles = (): AttachedFileMetadata[] => this.attachedFiles;
  public isLikelyTextFile = (name: string, type?: string): boolean =>
    isLikelyTextFile(name, type);

  // Actions for components
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
    // Event emitter will trigger update of this.attachedFiles via InputEvent.ATTACHED_FILES_CHANGED
  };

  public onFileRemove = (attachmentId: string) => {
    useInputStore.getState().removeAttachedFile(attachmentId);
    // Event emitter will trigger update of this.attachedFiles via InputEvent.ATTACHED_FILES_CHANGED
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
    this.modApi = null;
    console.log(`[${this.id}] Destroyed.`);
  }
}
