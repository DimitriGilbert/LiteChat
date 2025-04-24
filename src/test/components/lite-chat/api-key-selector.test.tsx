
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import { ChatContext } from "@/hooks/use-chat-context";
import type { ChatContextProps, DbApiKey, AiProviderConfig } from "@/lib/types";
import { TooltipProvider } from "@/components/ui/tooltip";


const mockSetSelectedApiKeyId = vi.fn();
const mockProviders: AiProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    docsUrl: "",
    models: [],
    requiresApiKey: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    docsUrl: "",
    models: [],
    requiresApiKey: true,
  },
  {
    id: "mock",
    name: "Mock Provider",
    docsUrl: "",
    models: [],
    requiresApiKey: false,
  },
];
let mockApiKeys: DbApiKey[] = [];


const renderApiKeySelector = (
  contextOverrides: Partial<ChatContextProps> = {},
) => {
  // Reset keys for each render call if needed, or manage outside
  const currentKeys = contextOverrides.apiKeys ?? mockApiKeys;
  const baseContext: Partial<ChatContextProps> = {
    apiKeys: currentKeys,
    selectedProviderId: "openai",
    selectedApiKeyId: {},
    setSelectedApiKeyId: mockSetSelectedApiKeyId,
    providers: mockProviders,
  };
  const contextValue = { ...baseContext, ...contextOverrides };
  return render(
    <TooltipProvider>
      <ChatContext.Provider value={contextValue as ChatContextProps}>
        <ApiKeySelector />
      </ChatContext.Provider>
    </TooltipProvider>,
  );
};


describe.skip("ApiKeySelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKeys = [
      {
        id: "k1",
        name: "OpenAI Key 1",
        providerId: "openai",
        value: "sk-1",
        createdAt: new Date(),
      },
      {
        id: "k2",
        name: "OpenAI Key 2",
        providerId: "openai",
        value: "sk-2",
        createdAt: new Date(),
      },
      {
        id: "k3",
        name: "Claude Key",
        providerId: "anthropic",
        value: "ak-1",
        createdAt: new Date(),
      },
    ];
  });
  it("does not render if selected provider does not require API key", () => {
    const { container } = renderApiKeySelector({ selectedProviderId: "mock" });
    expect(container.firstChild).toBeNull();
  });

  it("does not render if no provider is selected", () => {
    const { container } = renderApiKeySelector({ selectedProviderId: null });
    expect(container.firstChild).toBeNull();
  });
  it("renders the select trigger button when provider requires key", () => {
    renderApiKeySelector({ selectedProviderId: "openai" });
    const trigger = screen.getByRole("combobox", { name: "Select API Key" });
    expect(trigger).toBeInTheDocument();
  });

  it("disables the trigger if no keys are available for the selected provider", () => {
    renderApiKeySelector({
      selectedProviderId: "anthropic",
      apiKeys: mockApiKeys.filter((k) => k.providerId !== "anthropic"),
    });
    const trigger = screen.getByRole("combobox", { name: "Select API Key" });
    expect(trigger).toBeDisabled();
  });
  it("displays the currently selected key name in the trigger", () => {
    renderApiKeySelector({
      selectedProviderId: "openai",
      selectedApiKeyId: { openai: "k2" },
    });
    const trigger = screen.getByRole("combobox", { name: "Select API Key" });
    expect(trigger).toHaveTextContent("OpenAI Key 2");
    expect(trigger).not.toHaveTextContent(/None \(Use Default\)/i);
  });

  it("displays 'None (Use Default)' in trigger when no key is selected for the provider", () => {
    renderApiKeySelector({
      selectedProviderId: "openai",
      selectedApiKeyId: { openai: null },
    });
    const trigger = screen.getByRole("combobox", { name: "Select API Key" });
    expect(trigger).toHaveTextContent(/None \(Use Default\)/i);
  });

  it("displays 'None (Use Default)' in trigger as default when provider selected but no specific key selected yet", () => {
    renderApiKeySelector({
      selectedProviderId: "openai",
      selectedApiKeyId: {},
    });
    const trigger = screen.getByRole("combobox", { name: "Select API Key" });
    expect(trigger).toHaveTextContent(/None \(Use Default\)/i);
  });
  it("lists available keys and 'None' option after clicking trigger", async () => {
    const user = userEvent.setup();
    renderApiKeySelector({ selectedProviderId: "openai" });
    const selectTrigger = screen.getByRole("combobox", {
      name: "Select API Key",
    });
    await user.click(selectTrigger);
    const noneOption = await within(document.body).findByRole("option", {
      name: /None \(Use Default\)/i,
    });
    const key1Option = await within(document.body).findByRole("option", {
      name: "OpenAI Key 1",
    });
    const key2Option = await within(document.body).findByRole("option", {
      name: "OpenAI Key 2",
    });

    expect(noneOption).toBeInTheDocument();
    expect(key1Option).toBeInTheDocument();
    expect(key2Option).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Claude Key" })).toBeNull();
  });

  it("calls setSelectedApiKeyId with key id when a key is selected", async () => {
    const user = userEvent.setup();
    renderApiKeySelector({ selectedProviderId: "openai" });
    const selectTrigger = screen.getByRole("combobox", {
      name: "Select API Key",
    });
    await user.click(selectTrigger);

    const key1Option = await within(document.body).findByRole("option", {
      name: "OpenAI Key 1",
    });
    await user.click(key1Option);

    expect(mockSetSelectedApiKeyId).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedApiKeyId).toHaveBeenCalledWith("openai", "k1");
  });

  it("calls setSelectedApiKeyId with null when 'None' is selected", async () => {
    const user = userEvent.setup();
    renderApiKeySelector({
      selectedProviderId: "openai",
      selectedApiKeyId: { openai: "k1" },
    });
    const selectTrigger = screen.getByRole("combobox", {
      name: "Select API Key",
    });
    await user.click(selectTrigger);

    const noneOption = await within(document.body).findByRole("option", {
      name: /None \(Use Default\)/i,
    });
    await user.click(noneOption);

    expect(mockSetSelectedApiKeyId).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedApiKeyId).toHaveBeenCalledWith("openai", null);
  });
});
