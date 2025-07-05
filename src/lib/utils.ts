import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function for color interpolation
export const interpolateColor = (score: number): string => {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));
  
  if (clampedScore <= 30) {
    return "#22c55e"; // green
  } else if (clampedScore <= 60) {
    // Interpolate from green to yellow
    const ratio = (clampedScore - 30) / 30;
    const r = Math.round(34 + (234 - 34) * ratio);
    const g = Math.round(197 + (179 - 197) * ratio);
    const b = Math.round(94 + (8 - 94) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Interpolate from yellow to red
    const ratio = (clampedScore - 60) / 40;
    const r = Math.round(234 + (239 - 234) * ratio);
    const g = Math.round(179 + (68 - 179) * ratio);
    const b = Math.round(8 + (68 - 8) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
};
