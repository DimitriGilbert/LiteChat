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

*(Sections for Installation, Usage Examples, API Reference, Contributing, and License will be added here)*
