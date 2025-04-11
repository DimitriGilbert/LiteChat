// src/App.tsx
import React from "react";
import { LiteChat, type AiProviderConfig } from "./components/lite-chat/chat";
import { Toaster } from "@/components/ui/sonner";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const lmstudio = createOpenAICompatible({
  name: "lmstudio",
  baseURL: "http://192.168.1.70:1234/v1",
});
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
});

const chatProviders: AiProviderConfig[] = [
  {
    id: "local",
    name: "local",
    requiresApiKey: false,
    models: [
      {
        id: "gemma-3-4b-it",
        name: "gemma3 4b",
        instance: lmstudio("gemma-3-4b-it"),
      },
    ],
  },
  {
    id: "openrouter",
    name: "openrouter",
    requiresApiKey: true,
    models: [
      {
        id: "openrouter/quasar-alpha",
        name: "quasar alpha",
        instance: openrouter("openrouter/quasar-alpha"),
      },
      {
        id: "openrouter/optimus-alpha",
        name: "optimus A",
        instance: openrouter("openrouter/optimus-alpha"),
      },
      {
        id: "google/gemini-2.5-pro-exp-03-25",
        name: "gemini 2.5 pro FREE",
        instance: openrouter("google/gemini-2.5-pro-exp-03-25"),
      },
      {
        id: "google/gemini-2.5-pro-preview-03-25",
        name: "gemini 2.5 pro",
        instance: openrouter("google/gemini-2.5-pro-preview-03-25"),
      },
      {
        id: "google/gemini-2.0-flash-001",
        name: "gemini 2.0 flash",
        instance: openrouter("google/gemini-2.0-flash-001"),
      },
      {
        id: "moonshotai/kimi-vl-a3b-thinking:free",
        name: "kimi vl",
        instance: openrouter("moonshotai/kimi-vl-a3b-thinking:free"),
      },
    ],
  },
];

function App() {
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <main className="flex-grow overflow-hidden p-4">
        <LiteChat providers={chatProviders} />
      </main>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
