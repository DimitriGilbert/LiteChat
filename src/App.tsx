// src/App.tsx
import { LiteChat } from "./components/lite-chat/chat";
// import type { AiProviderConfig } from "@/lib/types"; // No longer needed here
import { Toaster } from "@/components/ui/sonner";
// import { createOpenAICompatible } from "@ai-sdk/openai-compatible"; // No longer needed here
import ErrorBoundary from "./components/error-boundary"; // Import the ErrorBoundary

// const lmstudio = createOpenAICompatible({
//   name: "lmstudio",
//   baseURL: "http://192.168.1.70:1234/v1",
// });
// const openrouter = createOpenAICompatible({
//   name: "openrouter",
//   baseURL: "https://openrouter.ai/api/v1",
// });
// const chatProviders: AiProviderConfig[] = [ ... ];
function App() {
  return (
    <ErrorBoundary>
      <div className="h-screen bg-gray-900 flex flex-col">
        <main className="flex-grow overflow-hidden p-4">
          {/* No providers prop needed */}
          <LiteChat />
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </ErrorBoundary>
  );
}

export default App;
