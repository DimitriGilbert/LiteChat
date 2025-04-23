
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): { throttled: (...args: Parameters<T>) => void; cancel: () => void } {
  let lastFunc: NodeJS.Timeout | undefined;
  let lastRan: number | undefined;

  const throttled = (...args: Parameters<T>) => {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          // Check if enough time has passed *before* executing
          if (Date.now() - (lastRan ?? 0) >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        },
        // Calculate remaining time accurately
        Math.max(0, limit - (Date.now() - (lastRan ?? 0))),
      );
    }
  };

  const cancel = () => {
    if (lastFunc) {
      clearTimeout(lastFunc);
      lastFunc = undefined;
      // Reset lastRan as well, so the next call executes immediately if needed
      // lastRan = undefined; // Optional: Reset lastRan on cancel? Depends on desired behavior.
      // Keeping lastRan allows the throttle timer to potentially resume if called again quickly.
      // Clearing it makes the next call immediate. Let's keep it for now.
    }
  };

  return { throttled, cancel };
}
