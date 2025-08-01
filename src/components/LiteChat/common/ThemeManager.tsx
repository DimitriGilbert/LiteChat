// src/components/LiteChat/common/ThemeManager.tsx

import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings.store";
import type { CustomThemeColors } from "@/store/settings.store";
import { THEME_OPTIONS } from "@/types/litechat/common";

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

// Theme to CSS class mapping
const THEME_CLASS_MAP: Record<string, string> = {
  light: "light",
  dark: "dark",
  TijuLight: "TijuLight",
  TijuDark: "TijuDark",
  bubblegum: "bubblegum",
  bubblegumDark: "bubblegumDark",
  candyland: "candyland",
  candylandDark: "candylandDark",
  doom64: "doom64",
  doom64Dark: "doom64Dark",
  luxury: "luxury",
  luxuryDark: "luxuryDark",
  northernLights: "northernLights",
  northernLightsDark: "northernLightsDark",
  retroArcade: "retroArcade",
  retroArcadeDark: "retroArcadeDark",
  staryNight: "staryNight",
  staryNightDark: "staryNightDark",
  tangerine: "tangerine",
  tangerineDark: "tangerineDark",
  custom: "custom",
};

export const ThemeManager: React.FC = () => {
  const theme = useSettingsStore((state) => state.theme);
  const customFontFamily = useSettingsStore((state) => state.customFontFamily);
  const customFontSize = useSettingsStore((state) => state.customFontSize);
  const customThemeColors = useSettingsStore((state) => state.customThemeColors);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;

    // --- Reset Custom Styles ---
    // Remove all theme classes first
    body.classList.remove(...THEME_OPTIONS);
    // Remove all known theme CSS variables from :root inline styles
    ALL_THEME_COLOR_KEYS.forEach((key) => {
      root.style.removeProperty(`--${camelToKebab(key)}`);
    });
    // Remove custom font/size variables from :root inline styles
    root.style.removeProperty("--custom-font-family");
    root.style.removeProperty("--custom-font-size");

    // --- Apply Selected Theme ---
    if (theme === "system") {
      // System theme (default)
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      if (systemPrefersDark) {
        body.classList.add("dark");
      } else {
        body.classList.add("light");
      }
    } else {
      // Apply theme class from mapping
      const themeClass = THEME_CLASS_MAP[theme];
      if (themeClass) {
        body.classList.add(themeClass);
      }

      // Apply custom styles only if theme is 'custom'
      if (theme === "custom") {
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
      }
    }
  }, [theme, customFontFamily, customFontSize, customThemeColors]);

  return null;
};
