// src/App.tsx
import { LiteChat } from "./components/LiteChat/LiteChat";

function App() {
  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <main className="flex-grow overflow-hidden">
        <LiteChat />
      </main>
    </div>
  );
}
export default App;
