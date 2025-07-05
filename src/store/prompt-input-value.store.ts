import { create } from "zustand";

interface PromptInputValueState {
  value: string;
  setValue: (value: string) => void;
}

export const usePromptInputValueStore = create<PromptInputValueState>((set) => ({
  value: "",
  setValue: (value) => set({ value }),
})); 