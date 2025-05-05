// src/components/LiteChat/common/PrismThemeLoader.tsx

import { useEffect, useMemo } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

// IDs for theme link elements
const PRISM_THEME_LINK_ID = "prism-theme-link";
const DEFAULT_LIGHT_THEME_LINK_ID = "prism-default-light-theme-link";
const DEFAULT_DARK_THEME_LINK_ID = "prism-default-dark-theme-link";

// Default theme URLs (using direct CDN links)
const DEFAULT_LIGHT_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-light.min.css";
const DEFAULT_DARK_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-coldark-dark.min.css";

/**
 * Manages the dynamic loading and switching of PrismJS theme CSS files
 * in the document head based on application settings.
 */
export const PrismThemeLoader: React.FC = () => {
  const { prismThemeUrl, theme: appTheme } = useSettingsStore(
    useShallow((state) => ({
      prismThemeUrl: state.prismThemeUrl,
      theme: state.theme,
    })),
  );

  const systemTheme = useMemo(() => {
    // Ensure this runs only client-side
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }, []);

  // Determine the effective theme mode (light/dark)
  const currentThemeMode = useMemo(() => {
    if (appTheme === "system") {
      return systemTheme;
    }
    if (appTheme === "TijuDark" || appTheme === "dark") {
      return "dark";
    }
    // Default to light for 'light', 'TijuLight', 'custom', or unknown
    return "light";
  }, [appTheme, systemTheme]);

  useEffect(() => {
    const loadTheme = (url: string, id: string): void => {
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.href !== url) {
        link.href = url;
      }
      link.disabled = false;
    };

    const disableTheme = (id: string): void => {
      const link = document.getElementById(id) as HTMLLinkElement | null;
      if (link) {
        link.disabled = true;
      }
    };

    if (prismThemeUrl) {
      // User provided a custom theme URL
      loadTheme(prismThemeUrl, PRISM_THEME_LINK_ID);
      disableTheme(DEFAULT_LIGHT_THEME_LINK_ID);
      disableTheme(DEFAULT_DARK_THEME_LINK_ID);
    } else {
      // Use default themes based on the effective light/dark mode
      disableTheme(PRISM_THEME_LINK_ID);
      if (currentThemeMode === "dark") {
        loadTheme(DEFAULT_DARK_THEME_URL, DEFAULT_DARK_THEME_LINK_ID);
        disableTheme(DEFAULT_LIGHT_THEME_LINK_ID);
      } else {
        loadTheme(DEFAULT_LIGHT_THEME_URL, DEFAULT_LIGHT_THEME_LINK_ID);
        disableTheme(DEFAULT_DARK_THEME_LINK_ID);
      }
    }
  }, [prismThemeUrl, currentThemeMode]);

  // This component doesn't render anything itself
  return null;
};
