// src/lib/throttle.ts
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastFunc: NodeJS.Timeout | undefined;
  let lastRan: number | undefined;
  return function (...args: Parameters<T>) {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      if (lastFunc) clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - (lastRan ?? 0) >= limit) {
            func(...args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - (lastRan ?? 0)),
      );
    }
  };
}
