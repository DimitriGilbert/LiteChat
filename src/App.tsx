// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <div>
//         <a href="https://vite.dev" target="_blank">
//           <img src={viteLogo} className="logo" alt="Vite logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <h1>Vite + React</h1>
//       <div className="card">
//         <button onClick={() => setCount((count) => count + 1)}>
//           count is {count}
//         </button>
//         <p>
//           Edit <code>src/App.tsx</code> and save to test HMR
//         </p>
//       </div>
//       <p className="read-the-docs">
//         Click on the Vite and React logos to learn more
//       </p>
//     </>
//   )
// }

// export default App

// In your App.tsx or a page component

import React from "react";
import { LiteChat, type AiProviderConfig } from "./components/lite-chat/chat"; // Adjust path
import { Button } from "./components/ui/button"; // User's shadcn button

// --- IMPORTANT: AI SDK Setup ---
// User needs to instantiate the models they want to support.
// This requires installing the relevant provider packages, e.g., @ai-sdk/openai
import { createOpenAI } from "@ai-sdk/openai";
// import { createAnthropic } from '@ai-sdk/anthropic'; // Example for Anthropic

// NOTE: For pure client-side usage with API keys, initialize providers *without* the key here.
// The key will be provided by the user via the Settings modal and used internally by the context.
// If a provider *requires* the key at instantiation (less common for client-side focus),
// you might need a different approach or only support providers allowing client-side key usage.

const openai = createOpenAI({
  // apiKey: 'YOUR_KEY', // DO NOT HARDCODE HERE for BYOK
  // Instead, rely on the component's internal key management
  // or configure the provider to read from environment/config if needed,
  // but the goal here is user-provided keys.
  // Compatibility check might be needed per provider for pure client-side key injection.
});

// const anthropic = createAnthropic({ }); // Example

// Define the providers and models configuration
const chatProviders: AiProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", instance: openai("gpt-4o") },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        instance: openai("gpt-3.5-turbo"),
      },
    ],
    // No apiKey here, user provides it via UI
  },
  // {
  //   id: 'anthropic',
  //   name: 'Anthropic',
  //   models: [
  //     { id: 'claude-3-opus', name: 'Claude 3 Opus', instance: anthropic('claude-3-opus-20240229') },
  //     { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', instance: anthropic('claude-3-sonnet-20240229') },
  //   ],
  // },
];

function App() {
  return (
    <div className="flex flex-col h-screen p-4 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">My AI Chat App</h1>
      <div className="flex-grow border rounded-lg shadow-md overflow-hidden">
        {/* --- Integrate LiteChat --- */}
        <LiteChat
          providers={chatProviders}
          className="h-full" // Make LiteChat fill its container
          // Optional: Customize sub-components
          // SideComponent={MyCustomSideBar}
          // WrapperComponent={MyCustomChatArea}
        />
      </div>
    </div>
  );
}

// --- Example of Customization (Optional) ---

// const MyCustomSideBar: React.FC<{ className?: string }> = ({ className }) => {
//   const { createConversation } = useChatContext(); // Access context if needed
//   return (
//     <aside className={`bg-blue-100 p-4 border-r ${className}`}>
//       <h2>My Sidebar</h2>
//       <Button onClick={() => createConversation("Custom Chat")}>New Custom Chat</Button>
//       <ChatHistory /> {/* Reuse existing component */}
//     </aside>
//   );
// };

export default App;
