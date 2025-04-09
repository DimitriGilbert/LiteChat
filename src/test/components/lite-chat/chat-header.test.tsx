// src/test/components/lite-chat/chat-header.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatHeader } from "@/components/lite-chat/chat-header"; // Alias used here
import { ChatContext } from "@/hooks/use-chat-context"; // Verify path
import type { ChatContextProps, DbConversation, DbProject } from "@/lib/types"; // Verify path
import { useLiveQuery } from "dexie-react-hooks";

// Mock useLiveQuery
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
const mockedUseLiveQuery = useLiveQuery as vi.Mock;

// Mock ChatHeaderActions using the alias path
// *** CRITICAL: Ensure your Vitest/Vite config handles the '@' alias correctly! ***
vi.mock("@/components/lite-chat/chat-header-actions", () => {
  // <-- Path changed to use alias
  // Keep the console log to check if the mock runs *now*
  console.log("--- Using Mock ChatHeaderActions (Alias Path) ---");
  return {
    ChatHeaderActions: vi.fn(({ conversationId }) => (
      <div data-testid="mock-chat-header-actions" data-convoid={conversationId}>
        Mock Actions
      </div>
    )),
  };
});

const mockConversation: DbConversation = {
  id: "convo-abc",
  parentId: "proj-123",
  title: "My Test Conversation",
  createdAt: new Date(),
  updatedAt: new Date(),
  systemPrompt: null,
};

const mockProject: DbProject = {
  id: "proj-123",
  parentId: null,
  name: "My Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Consistent render helper with more robust context
const renderChatHeader = (contextOverrides: Partial<ChatContextProps> = {}) => {
  const baseContext: ChatContextProps = {
    selectedItemId: null,
    selectedItemType: null,
    setSelectedItem: vi.fn(),
    messages: [],
    setMessages: vi.fn(),
    isLoading: false,
    setIsLoading: vi.fn(),
    error: null,
    setError: vi.fn(),
    input: "",
    setInput: vi.fn(),
    stop: vi.fn(),
    reload: vi.fn(),
    ...contextOverrides,
  };
  return render(
    <ChatContext.Provider value={baseContext}>
      <ChatHeader />
    </ChatContext.Provider>,
  );
};

describe("ChatHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseLiveQuery.mockReturnValue(null);
  });

  // --- Test Case 1 ---
  it("renders default title 'LiteChat' when no item is selected", async () => {
    renderChatHeader({ selectedItemId: null, selectedItemType: null });
    expect(
      screen.getByRole("heading", { name: "LiteChat" }),
    ).toBeInTheDocument();
    // Check console output for the *new* log message
    const actions = await screen.findByTestId("mock-chat-header-actions");
    expect(actions).toBeInTheDocument();
    expect(actions).not.toHaveAttribute("data-convoid");
  });

  // --- Test Case 2 ---
  it("renders conversation title when a conversation is selected", async () => {
    mockedUseLiveQuery.mockReturnValue(mockConversation);
    renderChatHeader({
      selectedItemId: "convo-abc",
      selectedItemType: "conversation",
    });
    expect(
      screen.getByRole("heading", { name: "My Test Conversation" }),
    ).toBeInTheDocument();
    // Check console output for the *new* log message
    const actions = await screen.findByTestId("mock-chat-header-actions");
    expect(actions).toBeInTheDocument();
    expect(actions).toHaveAttribute("data-convoid", "convo-abc");
  });

  // --- Test Case 3 ---
  it("renders project name when a project is selected", async () => {
    mockedUseLiveQuery.mockReturnValue(mockProject);
    renderChatHeader({
      selectedItemId: "proj-123",
      selectedItemType: "project",
    });
    expect(
      screen.getByRole("heading", { name: "My Test Project" }),
    ).toBeInTheDocument();
    // Check console output for the *new* log message
    const actions = await screen.findByTestId("mock-chat-header-actions");
    expect(actions).toBeInTheDocument();
    expect(actions).not.toHaveAttribute("data-convoid");
  });

  // --- Test Case 4 (Keep async/await for consistency) ---
  it("updates title when selected item changes", async () => {
    mockedUseLiveQuery.mockReturnValue(null);
    const baseContext: ChatContextProps = {
      selectedItemId: null,
      selectedItemType: null,
      setSelectedItem: vi.fn(),
      messages: [],
      setMessages: vi.fn(),
      isLoading: false,
      setIsLoading: vi.fn(),
      error: null,
      setError: vi.fn(),
      input: "",
      setInput: vi.fn(),
      stop: vi.fn(),
      reload: vi.fn(),
    };

    const { rerender } = render(
      <ChatContext.Provider value={baseContext}>
        <ChatHeader />
      </ChatContext.Provider>,
    );
    expect(
      screen.getByRole("heading", { name: "LiteChat" }),
    ).toBeInTheDocument();
    // Optional: await screen.findByTestId("mock-chat-header-actions");

    mockedUseLiveQuery.mockReturnValue(mockConversation);
    rerender(
      <ChatContext.Provider
        value={{
          ...baseContext,
          selectedItemId: "convo-abc",
          selectedItemType: "conversation",
        }}
      >
        <ChatHeader />
      </ChatContext.Provider>,
    );
    expect(
      screen.getByRole("heading", { name: "My Test Conversation" }),
    ).toBeInTheDocument();
    // Optional: await screen.findByTestId("mock-chat-header-actions");

    mockedUseLiveQuery.mockReturnValue(mockProject);
    rerender(
      <ChatContext.Provider
        value={{
          ...baseContext,
          selectedItemId: "proj-123",
          selectedItemType: "project",
        }}
      >
        <ChatHeader />
      </ChatContext.Provider>,
    );
    expect(
      screen.getByRole("heading", { name: "My Test Project" }),
    ).toBeInTheDocument();
    // Optional: await screen.findByTestId("mock-chat-header-actions");
  });
});
