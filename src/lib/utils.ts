import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function for color interpolation
export const interpolateColor = (score: number): string => {
  if (score <= 30) {
    return "#22c55e"; // green
  } else if (score <= 60) {
    // Interpolate from green to yellow
    const ratio = (score - 30) / 30;
    const r = Math.round(34 + (234 - 34) * ratio);
    const g = Math.round(197 + (179 - 197) * ratio);
    const b = Math.round(94 + (8 - 94) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Interpolate from yellow to red
    const ratio = (score - 60) / 40;
    const r = Math.round(234 + (239 - 234) * ratio);
    const g = Math.round(179 + (68 - 179) * ratio);
    const b = Math.round(8 + (68 - 8) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
};
