
import { LiteChat } from "./components/lite-chat/chat";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/error-boundary";

function App() {
  return (
    <ErrorBoundary>
      <div className="h-screen bg-gray-900 flex flex-col">
        <main className="flex-grow overflow-hidden">
          <LiteChat />
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </ErrorBoundary>
  );
}

export default App;
