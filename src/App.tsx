// src/App.tsx
import { LiteChat } from "./components/LiteChat/LiteChat";
import { useConversationStore } from "@/store/conversation.store";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
import { useProviderStore } from "@/store/provider.store";
import { useEffect } from "react";

function App() {
  useEffect(() => {
    useSettingsStore.getState().loadSettings();
    useProviderStore.getState().loadInitialData();
    useConversationStore.getState().loadConversations();
    useModStore.getState().loadDbMods();
  }, []);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col p-4">
      <h1 className="text-xl font-bold mb-4 text-center">LiteChat</h1>
      <main className="flex-grow overflow-hidden">
        <LiteChat />
      </main>
    </div>
  );
}
export default App;
