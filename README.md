# LiteChat ⚡️

**A Lightweight, Client-Side Only React AI Chat Component Library**

---

## Overview

**LiteChat** empowers developers to effortlessly integrate a feature-rich AI chat interface directly into their React applications, with **zero backend required**. Built with modern React standards and TypeScript, LiteChat is designed to be exceptionally lightweight, performant, and highly composable.

It operates purely within the user's browser, leveraging the power of the **Vercel AI SDK** for direct, client-side interaction with various AI models. Conversation history is securely persisted locally using **IndexedDB** via Dexie.js.

The core philosophy revolves around a **"Bring Your Own API Key" (BYOK)** model, giving end-users control over their AI provider credentials while simplifying deployment for developers. LiteChat is structured as a composable component system, making it easy to customize and integrate seamlessly, especially within ecosystems like **shadcn/ui**.

## Core Goals & Philosophy

*   **🚀 Simplicity & Lightweight:** Minimal footprint, easy integration, and no server-side dependencies. Get a chat interface running in minutes.
*   **💻 Client-Centric:** All operations, including AI interaction and storage, happen directly in the user's browser.
*   **🔑 User Empowerment (BYOK):** End-users provide and manage their own API keys, enhancing privacy and control.
*   **🧩 Maximum Composability:** Easily replace or customize individual UI components (like message bubbles, input areas, sidebars) to fit specific design needs.
*   **🌊 Performance:** Optimized for smooth streaming responses with throttled UI updates (~24fps target) to ensure a fluid user experience without overwhelming the browser.
*   **🔧 Agnostic & Flexible:** Designed to work with various AI providers supported by the Vercel AI SDK. Configuration is provided by the library user, not hardcoded.

## Key Features

*   **Pure Client-Side Operation:** No backend needed for core functionality.
*   **Vercel AI SDK Integration:** Leverages `streamText` for efficient, real-time AI responses.
*   **Bring Your Own API Key (BYOK):** Securely managed client-side (user responsibility).
*   **IndexedDB Persistence:** Uses Dexie.js to store conversation history locally.
*   **Composable UI Architecture:** Swap out sub-components easily.
*   **Real-time Streaming:** Displays AI responses token-by-token with configurable UI refresh rates.
*   **Provider/Model Selection:** Built-in UI for users to choose between configured AI providers and models.
*   **TypeScript:** Fully typed for a better developer experience.
*   **shadcn/ui Friendly:** Designed to be packaged and consumed like a `shadcn/ui` registry component.

## Architecture at a Glance

LiteChat follows a modern React component architecture:

1.  **`ChatProvider` (Context API):** Manages the core state, including conversation history, selected models, API keys (in-memory), streaming status, and AI interaction logic.
2.  **`useChatContext` Hook:** Provides access to the shared state and actions within child components.
3.  **Composable UI Components:**
    *   `LiteChat` (Main Wrapper)
        *   `ChatSide` (Sidebar: History, Settings Trigger)
        *   `ChatWrapper` (Main Chat Area)
            *   `ChatContent` (Scrollable message display area)
                *   `MessageBubble` (Individual message rendering, user/AI differentiation)
                    *   `MessageActions` (Copy, Regenerate etc.)
            *   `PromptWrapper` (Input area container)
                *   `PromptForm` (Handles input submission)
                    *   `PromptInput` (Text area for user input)
                    *   `PromptSettings` (Provider/Model selectors)
                    *   `PromptFiles` (Placeholder for file attachments)
                    *   `PromptActions` (Send button, etc.)
4.  **Persistence Layer:** `useChatStorage` hook interacts with `Dexie.js` to manage `conversations` and `messages` tables in IndexedDB.
5.  **AI Interaction:** The `ChatProvider` directly calls the Vercel AI SDK's `streamText` function using the user-configured model instance and API key (if required by the provider client-side).

## Composability Explained

The component structure (`ChatSide`, `ChatWrapper`, `MessageBubble`, `PromptInput`, etc.) is intentionally granular. Users of `LiteChat` can import these individual components and either use the default layout provided by the main `LiteChat` component or construct their own custom chat UI by assembling these (or compatible custom) components, all connected via the `ChatProvider` context.

## Client-Side Focus: Benefits & Considerations

Running entirely client-side means:
*   ✅ No server setup or maintenance costs.
*   ✅ Enhanced user privacy as conversations *can* stay entirely local.
*   ✅ Simplified deployment – just a static React app.
*   ⚠️ Users manage their API keys; storing keys in browser storage (`localStorage`) is a potential security risk users should be aware of. LiteChat facilitates the BYOK pattern but doesn't dictate secure key storage beyond the browser session by default.

---

## Composability Explained & Examples

The component structure (`ChatSide`, `ChatWrapper`, `MessageBubble`, `PromptInput`, etc.) is intentionally granular. Users of `LiteChat` can import these individual components and either use the default layout provided by the main `LiteChat` component or construct their own custom chat UI by assembling these (or compatible custom) components, all connected via the `ChatProvider` context.

### Example 1: Replacing the Message Bubble

You can create your own message bubble component and render it using the `messages` array from the context. This is useful if you want a completely different look for messages.

```tsx
// MyCustomChatDisplay.tsx
import React from 'react';
import { useChatContext, type Message } from '@/components/lite-chat/chat'; // Adjust path
import { ScrollArea } from '@/components/ui/scroll-area';

// Your custom message component
const MyBubble: React.FC<{ message: Message }> = ({ message }) => (
  <div style={{
    margin: '8px',
    padding: '10px',
    borderRadius: '8px',
    backgroundColor: message.role === 'user' ? '#e0f0ff' : '#f0f0f0',
    textAlign: message.role === 'user' ? 'right' : 'left',
  }}>
    <small>{message.role}</small>
    <p style={{ margin: 0 }}>{message.content}</p>
    {message.isStreaming && <span>▍</span>}
    {message.error && <p style={{ color: 'red', fontSize: '0.8em' }}>Error: {message.error}</p>}
  </div>
);

export const MyCustomChatDisplay: React.FC = () => {
  const { messages, isLoading } = useChatContext();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="flex-grow h-0">
      <div className="p-4">
        {isLoading && <p>Loading messages...</p>}
        {!isLoading && messages.map(msg => <MyBubble key={msg.id} message={msg} />)}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};

// MyCustomChatWrapper.tsx (Replaces the default ChatWrapper)
import React from 'react';
import { PromptWrapper } from '@/components/lite-chat/chat'; // Reuse prompt area
import { MyCustomChatDisplay } from './MyCustomChatDisplay';

export const MyCustomChatWrapper: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <main className={`flex flex-grow flex-col bg-background ${className}`}>
      <MyCustomChatDisplay /> {/* Use your custom display */}
      <PromptWrapper /> {/* Keep the default input or replace it too */}
    </main>
  );
};

// App.tsx (Integration)
import { LiteChat } from '@/components/lite-chat/chat';
import { MyCustomChatWrapper } from './MyCustomChatWrapper'; // Import your wrapper

function App() {
  return (
    // ...
    <LiteChat
      providers={chatProviders}
      WrapperComponent={MyCustomChatWrapper} // Pass your custom wrapper
    />
    // ...
  );
}
```

### Example 2: Replacing the Sidebar

You might want a different layout or additional controls in the sidebar.

```typescript
// MyCustomSidebar.tsx
import React from 'react';
import { useChatContext, ChatHistory } from '@/components/lite-chat/chat'; // Reuse history
import { Button } from '@/components/ui/button';
import { SettingsModal } from '@/components/lite-chat/settings-modal'; // Reuse settings modal

export const MyCustomSidebar: React.FC<{ className?: string }> = ({ className }) => {
  const { createConversation } = useChatContext();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <aside className={`flex flex-col border-r bg-blue-50 p-3 ${className}`}>
      <h2 className="text-lg font-semibold mb-2">My Custom Sidebar</h2>
      <Button onClick={() => createConversation("Custom New Chat")} variant="outline" className="mb-2">
        Create Custom Chat
      </Button>
      <div className="flex-grow h-0 mb-2">
        <ChatHistory /> {/* Embed existing history */}
      </div>
      <Button onClick={() => setSettingsOpen(true)} variant="secondary">
        Open Settings
      </Button>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
};

// App.tsx (Integration)
import { LiteChat } from '@/components/lite-chat/chat';
import { MyCustomSidebar } from './MyCustomSidebar'; // Import your sidebar

function App() {
  return (
    // ...
    <LiteChat
      providers={chatProviders}
      SideComponent={MyCustomSidebar} // Pass your custom sidebar
    />
    // ...
  );
}

```
Remember to import useChatContext and any other necessary sub-components from LiteChat to interact with the chat state and reuse parts you don't want to rebuild.
