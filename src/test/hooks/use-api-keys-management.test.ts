
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
import type { DbApiKey } from "@/lib/types";
import type { useChatStorage as UseChatStorageType } from "@/hooks/use-chat-storage";


const mockAddDbApiKey = vi.fn();
const mockDeleteDbApiKey = vi.fn();

const mockCreateProject = vi.fn();
const mockRenameProject = vi.fn();
const mockDeleteProject = vi.fn();
const mockGetProject = vi.fn();
const mockCreateConversation = vi.fn();
const mockDeleteConversation = vi.fn();
const mockRenameConversation = vi.fn();
const mockUpdateConversationSystemPrompt = vi.fn();
const mockGetConversation = vi.fn();
const mockAddDbMessage = vi.fn();
const mockUpdateDbMessageContent = vi.fn();
const mockDeleteDbMessage = vi.fn();
const mockGetDbMessagesUpTo = vi.fn();


let mockApiKeysStore: DbApiKey[] = [];


vi.mock("@/hooks/use-chat-storage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-chat-storage")>();
  return {
    ...actual,
    useChatStorage: vi.fn(() => ({
      apiKeys: [],
      addApiKey: mockAddDbApiKey,
      deleteApiKey: mockDeleteDbApiKey,
      projects: [],
      createProject: mockCreateProject,
      renameProject: mockRenameProject,
      deleteProject: mockDeleteProject,
      getProject: mockGetProject,
      conversations: [],
      createConversation: mockCreateConversation,
      deleteConversation: mockDeleteConversation,
      renameConversation: mockRenameConversation,
      updateConversationSystemPrompt: mockUpdateConversationSystemPrompt,
      getConversation: mockGetConversation,
      addDbMessage: mockAddDbMessage,
      updateDbMessageContent: mockUpdateDbMessageContent,
      deleteDbMessage: mockDeleteDbMessage,
      getDbMessagesUpTo: mockGetDbMessagesUpTo,
    })),
  };
});


const { useChatStorage } = await import("@/hooks/use-chat-storage");
const mockedUseChatStorage = useChatStorage as vi.MockedFunction<
  typeof UseChatStorageType
>;


const createMockStorageReturnValue = (
  currentApiKeys: DbApiKey[],
): ReturnType<typeof UseChatStorageType> => ({
  apiKeys: currentApiKeys,
  addApiKey: mockAddDbApiKey,
  deleteApiKey: mockDeleteDbApiKey,
  projects: [],
  createProject: mockCreateProject,
  renameProject: mockRenameProject,
  deleteProject: mockDeleteProject,
  getProject: mockGetProject,
  conversations: [],
  createConversation: mockCreateConversation,
  deleteConversation: mockDeleteConversation,
  renameConversation: mockRenameConversation,
  updateConversationSystemPrompt: mockUpdateConversationSystemPrompt,
  getConversation: mockGetConversation,
  addDbMessage: mockAddDbMessage,
  updateDbMessageContent: mockUpdateDbMessageContent,
  deleteDbMessage: mockDeleteDbMessage,
  getDbMessagesUpTo: mockGetDbMessagesUpTo,
});

describe("useApiKeysManagement", () => {
  beforeEach(() => {
    // Reset mocks and the shared state for each test
    vi.clearAllMocks();
    mockApiKeysStore = [];

    // Reset the implementation of the mocked hook for each test
    // It should return the *current* state of mockApiKeysStore
    mockedUseChatStorage.mockImplementation(() =>
      createMockStorageReturnValue([...mockApiKeysStore]),
    );
    mockAddDbApiKey.mockImplementation(async (name, providerId, value) => {
      const newId = `new-key-${Math.random().toString(36).substring(7)}`;
      const newKey: DbApiKey = {
        id: newId,
        name,
        providerId,
        value,
        createdAt: new Date(),
      };
      mockApiKeysStore.push(newKey);

      // Simulate the live query update by resetting the mock implementation
      // to return the *new* state of the store
      mockedUseChatStorage.mockImplementation(() =>
        createMockStorageReturnValue([...mockApiKeysStore]),
      );
      return newId;
    });

    mockDeleteDbApiKey.mockImplementation(async (id) => {
      mockApiKeysStore = mockApiKeysStore.filter((key) => key.id !== id);
      // Simulate the live query update
      mockedUseChatStorage.mockImplementation(() =>
        createMockStorageReturnValue([...mockApiKeysStore]),
      );
    });
  });

  it("initializes with empty keys and selections", () => {
    const { result } = renderHook(() => useApiKeysManagement());
    expect(result.current.apiKeys).toEqual([]);
    expect(result.current.selectedApiKeyId).toEqual({});
    expect(mockedUseChatStorage).toHaveBeenCalled();
  });

  it("adds an API key, updates list, and selects it", async () => {
    const { result, rerender } = renderHook(() => useApiKeysManagement());

    let addedKeyId = "";
    await act(async () => {
      addedKeyId = await result.current.addApiKey(
        "Test Key",
        "openai",
        "sk-123",
      );
    });
    rerender();

    expect(mockAddDbApiKey).toHaveBeenCalledWith(
      "Test Key",
      "openai",
      "sk-123",
    );
    expect(result.current.apiKeys).toHaveLength(1);
    expect(result.current.apiKeys[0].name).toBe("Test Key");
    expect(result.current.apiKeys[0].id).toBe(addedKeyId);
    expect(result.current.selectedApiKeyId).toEqual({ openai: addedKeyId });
  });

  it("deletes an API key and updates list", async () => {
    // Setup initial state directly in the store
    mockApiKeysStore = [
      {
        id: "key-to-delete",
        name: "Old Key",
        providerId: "anthropic",
        value: "ak-456",
        createdAt: new Date(),
      },
    ];
    mockedUseChatStorage.mockImplementation(() =>
      createMockStorageReturnValue([...mockApiKeysStore]),
    );

    const { result, rerender } = renderHook(() => useApiKeysManagement());
    rerender();
    expect(result.current.apiKeys).toHaveLength(1);

    await act(async () => {
      await result.current.deleteApiKey("key-to-delete");
    });
    rerender();

    expect(mockDeleteDbApiKey).toHaveBeenCalledWith("key-to-delete");
    expect(result.current.apiKeys).toHaveLength(0);
  });

  it("deselects a key if it is deleted while selected", async () => {
    // Setup initial state
    mockApiKeysStore = [
      {
        id: "key-to-delete-selected",
        name: "Selected Key",
        providerId: "google",
        value: "gk-789",
        createdAt: new Date(),
      },
    ];
    mockedUseChatStorage.mockImplementation(() =>
      createMockStorageReturnValue([...mockApiKeysStore]),
    );

    const { result, rerender } = renderHook(() => useApiKeysManagement());
    rerender();

    // Select the key
    act(() => {
      result.current.setSelectedApiKeyId("google", "key-to-delete-selected");
    });
    rerender();
    expect(result.current.selectedApiKeyId).toEqual({
      google: "key-to-delete-selected",
    });
    await act(async () => {
      await result.current.deleteApiKey("key-to-delete-selected");
    });
    rerender();

    expect(mockDeleteDbApiKey).toHaveBeenCalledWith("key-to-delete-selected");
    expect(result.current.apiKeys).toHaveLength(0);
    expect(result.current.selectedApiKeyId).toEqual({ google: null });
  });

  it("gets the correct API key value for the selected provider", async () => {
    // Setup initial state
    mockApiKeysStore = [
      {
        id: "openai-key-1",
        name: "OpenAI Key",
        providerId: "openai",
        value: "sk-abc",
        createdAt: new Date(),
      },
      {
        id: "anthropic-key-1",
        name: "Anthropic Key",
        providerId: "anthropic",
        value: "ak-def",
        createdAt: new Date(),
      },
    ];
    mockedUseChatStorage.mockImplementation(() =>
      createMockStorageReturnValue([...mockApiKeysStore]),
    );

    const { result, rerender } = renderHook(() => useApiKeysManagement());
    rerender();

    // Select OpenAI key
    act(() => {
      result.current.setSelectedApiKeyId("openai", "openai-key-1");
    });
    rerender();

    let keyValue = result.current.getApiKeyForProvider("openai");
    expect(keyValue).toBe("sk-abc");
    keyValue = result.current.getApiKeyForProvider("anthropic");
    expect(keyValue).toBeUndefined();
    act(() => {
      result.current.setSelectedApiKeyId("anthropic", "anthropic-key-1");
    });
    rerender();

    keyValue = result.current.getApiKeyForProvider("anthropic");
    expect(keyValue).toBe("ak-def");
    keyValue = result.current.getApiKeyForProvider("openai");
    expect(keyValue).toBe("sk-abc");
  });
});
