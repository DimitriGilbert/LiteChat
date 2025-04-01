// src/App.tsx
import React from "react";
import { LiteChat, type AiProviderConfig } from "./components/lite-chat/chat";
import { Toaster } from "@/components/ui/sonner";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const lmstudio = createOpenAICompatible({
  name: "lmstudio",
  baseURL: "http://192.168.1.70:1234",
});

const chatProviders: AiProviderConfig[] = [
  {
    id: "local",
    name: "local",
    requiresApiKey: false,
    models: [
      {
        id: "gemma-3-12b-it",
        name: "gemma3 12b",
        instance: lmstudio("gemma-3-12b-it"),
      },
      {
        id: "gemma-3-1b-it",
        name: "gemma3 1b",
        instance: lmstudio("gemma-3-1b-it"),
      },
    ],
  },
];

function App() {
  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <header className="border-b border-gray-800 bg-gray-800 py-3 px-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          LiteChat <span className="text-yellow-400">⚡️</span>
        </h1>
      </header>

      <main className="flex-grow overflow-hidden p-0 flex items-stretch">
        <div className="w-full mx-auto h-full flex">
          <LiteChat providers={chatProviders} className="h-full w-full" />
        </div>
      </main>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
