/**
 * Marks a codeblock button interaction to prevent auto-scroll interference.
 * This should be called in the click handler of any button in codeblock headers
 * to prevent the ChatCanvas auto-scroll logic from treating button-induced
 * scrolling as user scrolling.
 */
export function markCodeblockButtonInteraction(): void {
  const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
  if (viewport) {
    (viewport as any)._isCodeblockButtonInteraction = true;
    setTimeout(() => {
      (viewport as any)._isCodeblockButtonInteraction = false;
    }, 100);
  }
}

/**
 * Creates a standard click handler for codeblock buttons that prevents
 * scroll interference and executes the provided callback.
 */
export function createCodeblockButtonHandler(callback: () => void) {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    markCodeblockButtonInteraction();
    callback();
  };
} 