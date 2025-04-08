import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react"; // Import waitFor
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import type { AiProviderConfig } from "@/lib/types";

// Mock Providers (keep as is)
const mockProviders: AiProviderConfig[] = [
  // ... (providers definition)
  {
    id: "openai",
    name: "OpenAI",
    docsUrl: "",
    models: [
      { id: "gpt-4", name: "GPT-4", instance: {} as any },
      { id: "gpt-3.5", name: "GPT-3.5", instance: {} as any },
    ],
    requiresApiKey: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    docsUrl: "",
    models: [{ id: "claude-3", name: "Claude 3", instance: {} as any }],
    requiresApiKey: true,
  },
  {
    id: "mock",
    name: "Mock Provider",
    docsUrl: "",
    models: [{ id: "mock-model", name: "Mock Model", instance: {} as any }],
    requiresApiKey: false,
  },
];

describe("useProviderModelSelection", () => {
  beforeEach(() => {
    // Reset any state if necessary
  });

  it("initializes with null if no initial values and no providers", () => {
    const { result } = renderHook(() =>
      useProviderModelSelection({ providers: [] }),
    );
    expect(result.current.selectedProviderId).toBeNull();
    expect(result.current.selectedModelId).toBeNull();
    expect(result.current.selectedProvider).toBeUndefined();
    expect(result.current.selectedModel).toBeUndefined();
  });

  it("initializes with the first provider and its first model if no initial values", () => {
    // Rerender might be needed if initial effects rely on DOM being ready
    const { result, rerender } = renderHook(() =>
      useProviderModelSelection({ providers: mockProviders }),
    );
    // Initial render might set state, effects run, rerender ensures we see final state
    rerender();
    expect(result.current.selectedProviderId).toBe("openai");
    expect(result.current.selectedModelId).toBe("gpt-4");
    expect(result.current.selectedProvider).toBe(mockProviders[0]);
    expect(result.current.selectedModel).toBe(mockProviders[0].models[0]);
  });

  it("initializes with provided initial values", () => {
    const { result, rerender } = renderHook(() =>
      useProviderModelSelection({
        providers: mockProviders,
        initialProviderId: "anthropic",
        initialModelId: "claude-3",
      }),
    );
    rerender(); // Ensure effects run if any depend on initial props
    expect(result.current.selectedProviderId).toBe("anthropic");
    expect(result.current.selectedModelId).toBe("claude-3");
    expect(result.current.selectedProvider).toBe(mockProviders[1]);
    expect(result.current.selectedModel).toBe(mockProviders[1].models[0]);
  });

  it("updates provider and automatically selects the first model", () => {
    const { result, rerender } = renderHook(() =>
      useProviderModelSelection({ providers: mockProviders }),
    );
    rerender(); // Ensure initial state is set
    expect(result.current.selectedProviderId).toBe("openai");
    expect(result.current.selectedModelId).toBe("gpt-4");

    act(() => {
      result.current.setSelectedProviderId("anthropic");
    });
    // Rerender after act to ensure the useEffect that selects the model runs
    rerender();

    expect(result.current.selectedProviderId).toBe("anthropic");
    expect(result.current.selectedModelId).toBe("claude-3"); // Auto-selected first model
    expect(result.current.selectedProvider).toBe(mockProviders[1]);
    expect(result.current.selectedModel).toBe(mockProviders[1].models[0]);
  });

  it("updates model within the selected provider", () => {
    const { result, rerender } = renderHook(() =>
      useProviderModelSelection({ providers: mockProviders }),
    );
    rerender(); // Ensure initial state is set
    expect(result.current.selectedProviderId).toBe("openai");
    expect(result.current.selectedModelId).toBe("gpt-4");

    act(() => {
      result.current.setSelectedModelId("gpt-3.5");
    });
    // Rerender might be needed if other effects depend on modelId
    rerender();

    expect(result.current.selectedProviderId).toBe("openai");
    expect(result.current.selectedModelId).toBe("gpt-3.5");
    expect(result.current.selectedProvider).toBe(mockProviders[0]);
    expect(result.current.selectedModel).toBe(mockProviders[0].models[1]);
  });

  it("resets model if selected model is not valid for the new provider", () => {
    const { result, rerender } = renderHook(() =>
      useProviderModelSelection({
        providers: mockProviders,
        initialProviderId: "openai",
        initialModelId: "gpt-3.5", // Start with a specific model
      }),
    );
    rerender(); // Ensure initial state is set
    expect(result.current.selectedModelId).toBe("gpt-3.5");

    act(() => {
      result.current.setSelectedProviderId("anthropic");
    });
    // Rerender after act to ensure the useEffect that resets the model runs
    rerender();

    expect(result.current.selectedProviderId).toBe("anthropic");
    expect(result.current.selectedModelId).toBe("claude-3"); // Resets to first valid model
  });

  it("clears model if provider is set to null", async () => {
    // Make test async for waitFor
    const { result, rerender } = renderHook(() =>
      useProviderModelSelection({ providers: mockProviders }),
    );
    rerender(); // Ensure initial state is set
    expect(result.current.selectedProviderId).toBe("openai");
    expect(result.current.selectedModelId).toBe("gpt-4");

    act(() => {
      result.current.setSelectedProviderId(null);
    });
    // Rerender after act to ensure the useEffect that clears the model runs
    rerender();

    // Use waitFor to ensure state updates and effects have settled
    await waitFor(() => {
      expect(result.current.selectedProviderId).toBeNull(); // Check provider first
    });
    await waitFor(() => {
      expect(result.current.selectedModelId).toBeNull(); // Then check model
    });

    // Final check after waitFor
    expect(result.current.selectedProviderId).toBeNull();
    expect(result.current.selectedModelId).toBeNull();
    expect(result.current.selectedProvider).toBeUndefined();
    expect(result.current.selectedModel).toBeUndefined();
  });

  it("handles provider list changing", async () => {
    // Make test async for waitFor
    const initialProps = { providers: [mockProviders[0]] };
    const { result, rerender } = renderHook(
      // Pass the hook directly, initialProps are in the options object
      useProviderModelSelection,
      { initialProps }, // Start with only OpenAI
    );
    // No need for extra rerender immediately after renderHook with initialProps

    // Wait for initial state to settle (effects might run)
    await waitFor(() => {
      expect(result.current.selectedProviderId).toBe("openai");
    });
    expect(result.current.selectedModelId).toBe("gpt-4");

    // Rerender with the full list - pass the new props object directly
    const nextPropsFull = { providers: mockProviders };
    rerender(nextPropsFull); // Pass only the new props

    // Wait for effects triggered by prop change
    await waitFor(() => {
      // Selection should remain the same if still valid
      expect(result.current.selectedProviderId).toBe("openai");
      expect(result.current.selectedModelId).toBe("gpt-4");
    });

    // Rerender with only Anthropic - pass the new props object directly
    const nextPropsAnthropic = { providers: [mockProviders[1]] };
    rerender(nextPropsAnthropic); // Pass only the new props

    // Wait for effects triggered by prop change
    await waitFor(() => {
      // Should switch to the first available provider and its model
      expect(result.current.selectedProviderId).toBe("anthropic");
      expect(result.current.selectedModelId).toBe("claude-3");
    });
  });
});
