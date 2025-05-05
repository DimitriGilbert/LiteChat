// src/components/common/PrismThemeLoader.tsx
// NEW FILE
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
    return "light"; // Default server-side or if window is undefined
  }, []);

  const currentTheme = appTheme === "system" ? systemTheme : appTheme;

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
      loadTheme(prismThemeUrl, PRISM_THEME_LINK_ID);
      disableTheme(DEFAULT_LIGHT_THEME_LINK_ID);
      disableTheme(DEFAULT_DARK_THEME_LINK_ID);
    } else {
      disableTheme(PRISM_THEME_LINK_ID);
      if (currentTheme === "dark") {
        loadTheme(DEFAULT_DARK_THEME_URL, DEFAULT_DARK_THEME_LINK_ID);
        disableTheme(DEFAULT_LIGHT_THEME_LINK_ID);
      } else {
        loadTheme(DEFAULT_LIGHT_THEME_URL, DEFAULT_LIGHT_THEME_LINK_ID);
        disableTheme(DEFAULT_DARK_THEME_LINK_ID);
      }
    }
  }, [prismThemeUrl, currentTheme]);

  // This component doesn't render anything itself
  return null;
};
