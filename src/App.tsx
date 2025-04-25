// src/App.tsx
import { LiteChat } from "./components/LiteChat/LiteChat";
// Removed store imports and useEffect as initialization is now handled by LiteChat

function App() {
  // Removed the useEffect hook that called store load actions

  return (
    <div className="h-screen bg-background text-foreground flex flex-col p-4">
      <h1 className="text-xl font-bold mb-4 text-center">LiteChat Rewrite</h1>
      <main className="flex-grow overflow-hidden">
        {/* Render only the LiteChat component */}
        <LiteChat />
      </main>
    </div>
  );
}
export default App;
