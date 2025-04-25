// src/types/litechat/control.ts
// Specific types for core controls if they become complex.
export interface ModelProviderControlState {
  availableProviders: { id: string; name: string }[];
  availableModels: { id: string; name: string }[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  isLoading: boolean;
}

export interface FileControlState {
   attachedFiles: File[];
   selectedVfsPaths: string[];
}
