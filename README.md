# LiteChat ⚡️

A **lightweight**, **client-side only** React AI chat component library.

---

## Overview

**LiteChat** lets you **embed a fully client-side AI chat UI** into your React app **with zero backend**. It is:

- **Modular**: Enable or disable features like sidebar, VFS, API key management, advanced settings.
- **Composable**: Use the default UI or build your own with exported components.
- **Extensible**: Add custom prompt actions, message actions, and settings tabs.
- **BYOK**: Users bring their own API keys.
- **Local-first**: Stores data in IndexedDB via Dexie.js.
- **Streaming**: Smooth token-by-token AI responses.
- **Built with**: React 19, TypeScript, Tailwind CSS, shadcn/ui components.

---

## Key Features

- **Purely client-side**: No server needed.
- **Vercel AI SDK**: For streaming AI responses.
- **Bring Your Own API Key (BYOK)**: User-managed keys.
- **IndexedDB persistence**: Conversations, projects, API keys.
- **Optional modules**:
  - **Sidebar** with projects & chat history
  - **Virtual File System (VFS)** per chat/project
  - **Advanced AI settings** (temperature, system prompt, etc.)
  - **API key management UI**
- **Composable UI**: Use or replace any component.
- **Extensible**:
  - Add **custom buttons** to prompt area or message bubbles.
  - Add **custom tabs** to the settings modal.

---

## Architecture

### Core

- **`<ChatProvider>`**: Provides all chat state & actions.
- **`useChatContext()`**: Access full context.
- **`useCoreChatContext()`**: Access minimal core chat state (messages, streaming, prompt, submit).

### UI Components

- **`<LiteChat>`**: All-in-one default UI.
- **Composable parts**:
  - **Sidebar**: `<ChatSide>`, `<ChatHistory>`
  - **Chat area**: `<ChatWrapper>`, `<ChatContent>`, `<MessageBubble>`
  - **Prompt area**: `<PromptWrapper>`, `<PromptForm>`, `<PromptInput>`, `<PromptActions>`, `<PromptSettings>`
  - **Settings modal**: `<SettingsModal>`

### Optional Modules (configurable)

- **Sidebar** (projects, chat history)
- **Virtual File System (VFS)**
- **API Key Management**
- **Advanced AI Settings**

---

## Usage

### 1. **Basic Setup**

```tsx
import { LiteChat } from "litechat";
import { myProviders } from "./myProviders";

export default function App() {
  return <LiteChat providers={myProviders} />;
}
```

### 2. **Configure Features**

```tsx
<LiteChat
  providers={myProviders}
  config={{
    enableSidebar: true,
    enableVfs: false,
    enableApiKeyManagement: true,
    enableAdvancedSettings: false,
    initialProviderId: "openai",
    streamingThrottleRate: 50,
  }}
/>
```

### 3. **Add Custom Prompt or Message Actions**

```tsx
import { SendIcon, StarIcon } from "lucide-react";

const myPromptActions = [
  {
    id: "hello",
    icon: <SendIcon size={16} />,
    tooltip: "Say Hello",
    onClick: (ctx) => ctx.setPrompt("Hello!"),
  },
];

const myMessageActions = [
  {
    id: "star",
    icon: <StarIcon size={16} />,
    tooltip: "Star message",
    onClick: (msg, ctx) => alert(`Starred message: ${msg.content}`),
    isVisible: (msg) => msg.role === "assistant",
  },
];

<LiteChat
  providers={myProviders}
  config={{
    customPromptActions: myPromptActions,
    customMessageActions: myMessageActions,
  }}
/>
```

### 4. **Add Custom Settings Tabs**

```tsx
const MyCustomSettingsTab = ({ context }) => (
  <div className="p-4">
    <h3 className="text-lg font-bold mb-2">My Custom Tab</h3>
    <p>Access chat context here:</p>
    <pre>{JSON.stringify(context.prompt, null, 2)}</pre>
  </div>
);

<LiteChat
  providers={myProviders}
  config={{
    customSettingsTabs: [
      {
        id: "mytab",
        title: "My Tab",
        component: MyCustomSettingsTab,
      },
    ],
  }}
/>
```

---

## Composability

You can **replace or customize** any UI part:

```tsx
import {
  ChatProvider,
  ChatSide,
  ChatWrapper,
  useChatContext,
} from "litechat";

export default function MyChat() {
  return (
    <ChatProvider providers={myProviders}>
      <div className="flex">
        <ChatSide />
        <ChatWrapper />
      </div>
    </ChatProvider>
  );
}
```

Or **build your own UI** with **exported hooks and components**.

---

## Configuration Options (`LiteChatConfig`)

| Option                   | Type                     | Default     | Description                                         |
|--------------------------|--------------------------|-------------|-----------------------------------------------------|
| `enableSidebar`          | `boolean`                | `true`      | Show sidebar with projects/history                  |
| `enableVfs`              | `boolean`                | `true`      | Enable Virtual File System                          |
| `enableApiKeyManagement` | `boolean`                | `true`      | Enable API key management UI                        |
| `enableAdvancedSettings` | `boolean`                | `true`      | Enable advanced AI settings                         |
| `initialProviderId`      | `string \| null`         | `null`      | Initial provider ID                                 |
| `initialModelId`         | `string \| null`         | `null`      | Initial model ID                                    |
| `initialSelectedItemId`  | `string \| null`         | `null`      | Initial selected sidebar item                       |
| `initialSelectedItemType`| `"conversation" \| "project" \| null` | `null` | Initial selected item type                          |
| `streamingThrottleRate`  | `number`                 | `42`        | Streaming UI update throttle in ms                  |
| `defaultSidebarOpen`     | `boolean`                | `true`      | Sidebar open by default                             |
| `customPromptActions`    | `CustomPromptAction[]`   | `[]`        | Custom buttons in prompt area                       |
| `customMessageActions`   | `CustomMessageAction[]`  | `[]`        | Custom buttons on message bubbles                   |
| `customSettingsTabs`     | `CustomSettingTab[]`     | `[]`        | Custom tabs in settings modal                       |

---

## Extensibility APIs

### Custom Prompt Actions

Add buttons next to the send button.

```ts
interface CustomPromptAction {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  className?: string;
  onClick: (context: ChatContextProps) => void;
}
```

### Custom Message Actions

Add buttons on each message bubble.

```ts
interface CustomMessageAction {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  className?: string;
  onClick: (message: Message, context: ChatContextProps) => void;
  isVisible?: (message: Message, context: ChatContextProps) => boolean;
}
```

### Custom Settings Tabs

Add tabs to the settings modal.

```ts
interface CustomSettingTab {
  id: string;
  title: string;
  component: React.ComponentType<{ context: ChatContextProps }>;
}
```

---

## Client-Side Focus: Benefits & Considerations

- **No backend needed**
- **User privacy**: data stays local
- **BYOK**: user manages their API keys
- **Security**: API keys stored in browser, so users should be aware of risks
- **Deployment**: just a static React app

---

## License

MIT
