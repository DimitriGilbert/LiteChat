// src/App.tsx
import React from "react";
import { LiteChat, type AiProviderConfig } from "./components/lite-chat/chat";
import { Toaster } from "@/components/ui/sonner";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const lmstudio = createOpenAICompatible({
  name: "lmstudio",
  baseURL: "http://192.168.1.70:1234/v1",
});

const chatProviders: AiProviderConfig[] = [
  {
    id: "local",
    name: "local",
    requiresApiKey: false,
    models: [
      {
        id: "gemma-3-1b-it",
        name: "gemma3 1b",
        instance: lmstudio("gemma-3-1b-it"),
      },
      {
        id: "gemma-3-12b-it",
        name: "gemma3 12b",
        instance: lmstudio("gemma-3-12b-it"),
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
