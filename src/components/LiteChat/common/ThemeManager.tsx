// src/components/LiteChat/common/ThemeManager.tsx

import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import type { CustomThemeColors } from "@/store/settings.store";

// Helper to convert camelCase to kebab-case for CSS variables
const camelToKebab = (str: string) =>
  str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();

// Define all potential theme CSS variables based on CustomThemeColors and defaults
const ALL_THEME_COLOR_KEYS: (keyof CustomThemeColors)[] = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "destructiveForeground",
  "border",
  "input",
  "ring",
  // Add chart and sidebar keys if they are intended to be customizable
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
  "sidebar",
  "sidebarForeground",
  "sidebarPrimary",
  "sidebarPrimaryForeground",
  "sidebarAccent",
  "sidebarAccentForeground",
  "sidebarBorder",
  "sidebarRing",
];

export const ThemeManager: React.FC = () => {
  const { theme, customFontFamily, customFontSize, customThemeColors } =
    useSettingsStore(
      useShallow((state) => ({
        theme: state.theme,
        customFontFamily: state.customFontFamily,
        customFontSize: state.customFontSize,
        customThemeColors: state.customThemeColors,
      })),
    );

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;

    // --- Reset Custom Styles ---
    // Remove all theme classes first
    body.classList.remove("light", "dark", "TijuLight", "TijuDark", "custom");
    // Remove all known theme CSS variables from :root inline styles
    ALL_THEME_COLOR_KEYS.forEach((key) => {
      root.style.removeProperty(`--${camelToKebab(key)}`);
    });
    // Remove custom font/size variables from :root inline styles
    root.style.removeProperty("--custom-font-family");
    root.style.removeProperty("--custom-font-size");

    // --- Apply Selected Theme ---
    if (theme === "light") {
      body.classList.add("light");
    } else if (theme === "dark") {
      body.classList.add("dark");
    } else if (theme === "TijuLight") {
      body.classList.add("TijuLight");
    } else if (theme === "TijuDark") {
      body.classList.add("TijuDark");
    } else if (theme === "custom") {
      body.classList.add("custom");

      // Apply custom styles only if theme is 'custom' by setting CSS variables on :root
      // Font Family
      if (customFontFamily) {
        root.style.setProperty("--custom-font-family", customFontFamily);
      } else {
        // Explicitly remove if null/empty to revert to base CSS
        root.style.removeProperty("--custom-font-family");
      }
      // Font Size
      if (customFontSize) {
        root.style.setProperty("--custom-font-size", `${customFontSize}px`);
      } else {
        // Explicitly remove if null/empty
        root.style.removeProperty("--custom-font-size");
      }
      // Custom Colors (as CSS Variables)
      if (customThemeColors) {
        Object.entries(customThemeColors).forEach(([key, value]) => {
          // Ensure the key is one we expect to manage
          if (
            value &&
            ALL_THEME_COLOR_KEYS.includes(key as keyof CustomThemeColors)
          ) {
            const cssVarName = `--${camelToKebab(key)}`;
            // Set the variable on the root element's inline style
            root.style.setProperty(cssVarName, value);
          } else if (
            ALL_THEME_COLOR_KEYS.includes(key as keyof CustomThemeColors)
          ) {
            // Explicitly remove if value is null/empty for a known key
            const cssVarName = `--${camelToKebab(key)}`;
            root.style.removeProperty(cssVarName);
          }
        });
      }
      // For 'custom' theme, CSS variables set here will override the defaults
      // defined in index.css :root because inline styles have higher specificity.
      // If a custom variable is *not* set, the default from index.css will apply.
    } else {
      // System theme (default)
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      if (systemPrefersDark) {
        body.classList.add("dark");
      } else {
        body.classList.add("light");
      }
      // Ensure custom styles are reset for system theme as well
      // (Already handled by the reset logic at the start of the effect)
    }
  }, [theme, customFontFamily, customFontSize, customThemeColors]);

  return null;
};
