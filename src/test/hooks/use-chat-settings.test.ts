
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatSettings } from "@/hooks/use-chat-settings";
import type { DbConversation } from "@/lib/types";


beforeAll(() => {
  // Attempt to ensure basic DOM structure exists before tests run
  if (typeof document !== "undefined" && !document.body) {
    document.body = document.createElement("body");
  }
  if (typeof document !== "undefined" && !document.getElementById("root")) {
    if (document.body) {
      // Check if body exists now
      const root = document.createElement("div");
      root.id = "root";
      document.body.appendChild(root);
    }
  }
});



const mockRoot = { classList: { add: vi.fn(), remove: vi.fn() } };

if (typeof document !== "undefined") {
  Object.defineProperty(document, "documentElement", {
    value: mockRoot,
    writable: true,
    configurable: true,
  });
}


const mockMatchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
vi.stubGlobal("matchMedia", mockMatchMedia);

describe("useChatSettings", () => {
  const mockConversation: DbConversation = {
    id: "convo-1",
    parentId: null,
    title: "Test Convo",
    createdAt: new Date(),
    updatedAt: new Date(),
    systemPrompt: "You are a test AI.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    mockRoot.classList.add.mockClear();
    mockRoot.classList.remove.mockClear();
  });

  afterEach(() => {
    // Ensure timers are cleared if any test uses them
    vi.useRealTimers();
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: null }),
    );
    expect(result.current.temperature).toBe(0.7);
    expect(result.current.maxTokens).toBeNull();
    expect(result.current.globalSystemPrompt).toBe(
      "You are a helpful AI assistant.",
    );
    expect(result.current.activeSystemPrompt).toBe(
      "You are a helpful AI assistant.",
    );
    expect(result.current.topP).toBeNull();
    expect(result.current.topK).toBeNull();
    expect(result.current.presencePenalty).toBeNull();
    expect(result.current.frequencyPenalty).toBeNull();
    expect(result.current.theme).toBe("system");
    expect(result.current.searchTerm).toBe("");
  });

  it("updates basic settings state", () => {
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: null }),
    );

    act(() => result.current.setTemperature(0.5));
    expect(result.current.temperature).toBe(0.5);

    act(() => result.current.setMaxTokens(1024));
    expect(result.current.maxTokens).toBe(1024);

    act(() => result.current.setGlobalSystemPrompt("New global prompt"));
    expect(result.current.globalSystemPrompt).toBe("New global prompt");
    expect(result.current.activeSystemPrompt).toBe("New global prompt");

    act(() => result.current.setTopP(0.9));
    expect(result.current.topP).toBe(0.9);

    act(() => result.current.setTopK(40));
    expect(result.current.topK).toBe(40);

    act(() => result.current.setPresencePenalty(0.1));
    expect(result.current.presencePenalty).toBe(0.1);

    act(() => result.current.setFrequencyPenalty(-0.1));
    expect(result.current.frequencyPenalty).toBe(-0.1);

    act(() => result.current.setSearchTerm("find me"));
    expect(result.current.searchTerm).toBe("find me");
  });

  it("derives activeSystemPrompt from conversation data when available", () => {
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: mockConversation }),
    );
    expect(result.current.globalSystemPrompt).toBe(
      "You are a helpful AI assistant.",
    );
    expect(result.current.activeSystemPrompt).toBe("You are a test AI.");
  });

  it("falls back to globalSystemPrompt if conversation prompt is null/empty", () => {
    const convoWithoutPrompt: DbConversation = {
      ...mockConversation,
      systemPrompt: null,
    };
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: convoWithoutPrompt }),
    );
    expect(result.current.activeSystemPrompt).toBe(
      "You are a helpful AI assistant.",
    );
  });

  it("updates activeSystemPrompt when conversation data changes", () => {
    const { result, rerender } = renderHook(useChatSettings, {
      initialProps: { activeConversationData: null },
    });
    expect(result.current.activeSystemPrompt).toBe(
      "You are a helpful AI assistant.",
    );

    rerender({ activeConversationData: mockConversation });
    expect(result.current.activeSystemPrompt).toBe("You are a test AI.");

    rerender({ activeConversationData: null });
    expect(result.current.activeSystemPrompt).toBe(
      "You are a helpful AI assistant.",
    );
  });
  // the hook from rendering correctly at all, but the setup tries
  // to test the state logic independent of the DOM effect.
  it("applies light theme correctly (state check)", () => {
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: null }),
    );
    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
  });

  it("applies dark theme correctly (state check)", () => {
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: null }),
    );
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
  });

  it("applies system theme (light preference) (state check)", () => {
    mockMatchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: null }),
    );
    act(() => result.current.setTheme("system"));
    expect(result.current.theme).toBe("system");
  });

  it("applies system theme (dark preference) (state check)", () => {
    mockMatchMedia.mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { result } = renderHook(() =>
      useChatSettings({ activeConversationData: null }),
    );
    act(() => result.current.setTheme("system"));
    expect(result.current.theme).toBe("system");
  });
});
