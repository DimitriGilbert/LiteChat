
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatInput } from "@/hooks/use-chat-input";

describe("useChatInput", () => {
  beforeEach(() => {
    // Reset any potential global state if needed, though this hook is self-contained
  });

  it("initializes with empty prompt and files", () => {
    const { result } = renderHook(() => useChatInput());
    expect(result.current.prompt).toBe("");
    expect(result.current.attachedFiles).toEqual([]);
  });

  it("updates prompt using setPrompt", () => {
    const { result } = renderHook(() => useChatInput());
    act(() => {
      result.current.setPrompt("Hello");
    });
    expect(result.current.prompt).toBe("Hello");
    act(() => {
      result.current.setPrompt("Hello World");
    });
    expect(result.current.prompt).toBe("Hello World");
  });

  it("adds a file using addAttachedFile", () => {
    const { result } = renderHook(() => useChatInput());
    const file1 = new File(["content1"], "file1.txt", { type: "text/plain" });
    act(() => {
      result.current.addAttachedFile(file1);
    });
    expect(result.current.attachedFiles).toHaveLength(1);
    expect(result.current.attachedFiles[0]).toBe(file1);

    const file2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });
    act(() => {
      result.current.addAttachedFile(file2);
    });
    expect(result.current.attachedFiles).toHaveLength(2);
    expect(result.current.attachedFiles[1]).toBe(file2);
  });

  it("removes a file using removeAttachedFile", () => {
    const { result } = renderHook(() => useChatInput());
    const file1 = new File(["content1"], "file1.txt", { type: "text/plain" });
    const file2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });
    act(() => {
      result.current.addAttachedFile(file1);
      result.current.addAttachedFile(file2);
    });
    expect(result.current.attachedFiles).toHaveLength(2);

    act(() => {
      result.current.removeAttachedFile("file1.txt");
    });
    expect(result.current.attachedFiles).toHaveLength(1);
    expect(result.current.attachedFiles[0]).toBe(file2);

    // Try removing non-existent file
    act(() => {
      result.current.removeAttachedFile("nonexistent.png");
    });
    expect(result.current.attachedFiles).toHaveLength(1); // Should not change

    act(() => {
      result.current.removeAttachedFile("file2.jpg");
    });
    expect(result.current.attachedFiles).toHaveLength(0);
  });

  it("clears all files using clearAttachedFiles", () => {
    const { result } = renderHook(() => useChatInput());
    const file1 = new File(["content1"], "file1.txt", { type: "text/plain" });
    const file2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });
    act(() => {
      result.current.addAttachedFile(file1);
      result.current.addAttachedFile(file2);
    });
    expect(result.current.attachedFiles).toHaveLength(2);

    act(() => {
      result.current.clearAttachedFiles();
    });
    expect(result.current.attachedFiles).toHaveLength(0);
  });
});
