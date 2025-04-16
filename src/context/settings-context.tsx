// src/context/settings-context.tsx
import React, { createContext, useContext, useMemo } from "react";
import type { DbConversation, DbProject } from "@/lib/types";
import { useChatSettings } from "@/hooks/use-chat-settings";

interface SettingsContextProps {
  enableAdvancedSettings: boolean;
  theme: "light" | "dark" | "system";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark" | "system">>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  maxTokens: number | null;
  setMaxTokens: React.Dispatch<React.SetStateAction<number | null>>;
  globalSystemPrompt: string | null;
  setGlobalSystemPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  activeSystemPrompt: string | null;
  topP: number | null;
  setTopP: React.Dispatch<React.SetStateAction<number | null>>;
  topK: number | null;
  setTopK: React.Dispatch<React.SetStateAction<number | null>>;
  presencePenalty: number | null;
  setPresencePenalty: React.Dispatch<React.SetStateAction<number | null>>;
  frequencyPenalty: number | null;
  setFrequencyPenalty: React.Dispatch<React.SetStateAction<number | null>>;
  isSettingsModalOpen: boolean;
  onSettingsModalOpenChange: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(
  undefined,
);

interface SettingsProviderProps {
  children: React.ReactNode;
  enableAdvancedSettings?: boolean;
  // Pass active item data needed by useChatSettings
  activeConversationData: DbConversation | null;
  activeProjectData: DbProject | null;
  // Pass modal state control
  isSettingsModalOpen: boolean;
  onSettingsModalOpenChange: (open: boolean) => void;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
  enableAdvancedSettings = true,
  activeConversationData,
  activeProjectData,
  isSettingsModalOpen,
  onSettingsModalOpenChange,
}) => {
  const chatSettings = useChatSettings({
    activeConversationData,
    activeProjectData,
    enableAdvancedSettings,
  });

  const value = useMemo(
    () => ({
      enableAdvancedSettings: enableAdvancedSettings ?? true,
      theme: chatSettings.theme,
      setTheme: chatSettings.setTheme,
      searchTerm: chatSettings.searchTerm,
      setSearchTerm: chatSettings.setSearchTerm,
      temperature: chatSettings.temperature,
      setTemperature: chatSettings.setTemperature,
      maxTokens: chatSettings.maxTokens,
      setMaxTokens: chatSettings.setMaxTokens,
      globalSystemPrompt: chatSettings.globalSystemPrompt,
      setGlobalSystemPrompt: chatSettings.setGlobalSystemPrompt,
      activeSystemPrompt: chatSettings.activeSystemPrompt,
      topP: chatSettings.topP,
      setTopP: chatSettings.setTopP,
      topK: chatSettings.topK,
      setTopK: chatSettings.setTopK,
      presencePenalty: chatSettings.presencePenalty,
      setPresencePenalty: chatSettings.setPresencePenalty,
      frequencyPenalty: chatSettings.frequencyPenalty,
      setFrequencyPenalty: chatSettings.setFrequencyPenalty,
      isSettingsModalOpen,
      onSettingsModalOpenChange,
    }),
    [
      enableAdvancedSettings,
      chatSettings.theme,
      chatSettings.setTheme,
      chatSettings.searchTerm,
      chatSettings.setSearchTerm,
      chatSettings.temperature,
      chatSettings.setTemperature,
      chatSettings.maxTokens,
      chatSettings.setMaxTokens,
      chatSettings.globalSystemPrompt,
      chatSettings.setGlobalSystemPrompt,
      chatSettings.activeSystemPrompt,
      chatSettings.topP,
      chatSettings.setTopP,
      chatSettings.topK,
      chatSettings.setTopK,
      chatSettings.presencePenalty,
      chatSettings.setPresencePenalty,
      chatSettings.frequencyPenalty,
      chatSettings.setFrequencyPenalty,
      isSettingsModalOpen,
      onSettingsModalOpenChange,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = (): SettingsContextProps => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error(
      "useSettingsContext must be used within a SettingsProvider",
    );
  }
  return context;
};
