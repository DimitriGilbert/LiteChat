// src/test/setup.ts
import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// Keep this configuration if you want to suppress large DOM output
configure({
  getElementError: (message, container) => {
    const error = new Error(message || "TestingLibraryElementError");
    error.name = "TestingLibraryElementError";
    return error;
  },
});

// --- PointerEvent Mocks (Keep these) ---
if (typeof window !== "undefined") {
  if (!window.PointerEvent) {
    class MockPointerEvent extends Event {
      button: number;
      ctrlKey: boolean;
      pointerType: string;
      constructor(type: string, props: PointerEventInit) {
        super(type, props);
        this.button = props.button ?? 0;
        this.ctrlKey = props.ctrlKey ?? false;
        this.pointerType = props.pointerType ?? "mouse";
      }
    }
    window.PointerEvent = MockPointerEvent as any;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
}
// --- End of PointerEvent Mocks ---

// --- Other Mocks (Keep these) ---
// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    },
  };
})();
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock IntersectionObserver
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}));
vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

// Mock window.confirm
window.confirm = vi.fn(() => true);

// Mock navigator.clipboard
vi.stubGlobal("navigator", {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve("")),
  },
});

// Mock Dexie (Keep your global mock)
vi.mock("@/lib/db", () => ({
  db: {
    // ... (your existing detailed mock) ...
    conversations: {
      get: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue("mock-convo-id"),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(1),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          sortBy: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
          count: vi.fn().mockResolvedValue(0),
        })),
      })),
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      toArray: vi.fn().mockResolvedValue([]),
      bulkAdd: vi.fn().mockResolvedValue("mock-last-key"),
    },
    messages: {
      get: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue("mock-message-id"),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(1),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          sortBy: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
          and: vi.fn(() => ({
            sortBy: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
      bulkAdd: vi.fn().mockResolvedValue("mock-last-key"),
      toArray: vi.fn().mockResolvedValue([]),
    },
    apiKeys: {
      get: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue("mock-key-id"),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(1),
      orderBy: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
      })),
      toArray: vi.fn().mockResolvedValue([]),
    },
    projects: {
      get: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue("mock-project-id"),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(1),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          sortBy: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue(0),
          count: vi.fn().mockResolvedValue(0),
        })),
      })),
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
        })),
      })),
      toArray: vi.fn().mockResolvedValue([]),
    },
    delete: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (mode, tables, callback) => {
      await callback();
    }),
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "mock-nanoid"),
}));
// --- End Other Mocks ---

// --- Clean up after each test ---
afterEach(() => {
  cleanup(); // Cleans up RTL renders
  vi.clearAllMocks(); // Clears mock call history etc.
  localStorageMock.clear(); // Clear mocked localStorage
});
