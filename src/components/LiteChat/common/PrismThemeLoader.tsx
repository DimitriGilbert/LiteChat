import { useEffect, useMemo } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

const PRISM_THEME_LINK_ID = "prism-theme-link";
const DEFAULT_LIGHT_THEME_LINK_ID = "prism-default-light-theme-link";
const DEFAULT_DARK_THEME_LINK_ID = "prism-default-dark-theme-link";

const DEFAULT_LIGHT_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-light.min.css";
const DEFAULT_DARK_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-vsc-dark-plus.min.css";

// Helper to ensure link exists and set attributes
const ensureLinkElement = (id: string): HTMLLinkElement => {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  return link;
};

export const PrismThemeLoader: React.FC = () => {
  const { prismThemeUrl, theme: appTheme } = useSettingsStore(
    useShallow((state) => ({
      prismThemeUrl: state.prismThemeUrl,
      theme: state.theme,
    })),
  );

  const systemTheme = useMemo(() => {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }, []);

  // Determine the current theme mode (dark or light)
  const currentThemeMode = useMemo(() => {
    const effectiveTheme = appTheme === "system" ? systemTheme : appTheme;
    return effectiveTheme === "dark" || effectiveTheme === "TijuDark"
      ? "dark"
      : "light";
  }, [appTheme, systemTheme]);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return;

    // Create all three link elements
    const lightLink = ensureLinkElement(DEFAULT_LIGHT_THEME_LINK_ID);
    const darkLink = ensureLinkElement(DEFAULT_DARK_THEME_LINK_ID);
    const customLink = ensureLinkElement(PRISM_THEME_LINK_ID);

    // Disable all links first
    lightLink.disabled = true;
    darkLink.disabled = true;
    customLink.disabled = true;

    // Set appropriate URLs
    lightLink.href = DEFAULT_LIGHT_THEME_URL;
    darkLink.href = DEFAULT_DARK_THEME_URL;

    // Determine which link should be enabled
    if (prismThemeUrl) {
      // Custom theme takes precedence
      customLink.href = prismThemeUrl;
      customLink.disabled = false;
    } else {
      // Use default theme based on current mode
      console.log(currentThemeMode);
      if (currentThemeMode === "dark") {
        darkLink.disabled = false;
      } else {
        lightLink.disabled = false;
      }
    }

    // Clean up function
    return () => {
      // No cleanup needed for link elements as they persist
    };
  }, [prismThemeUrl, currentThemeMode]);

  return null;
};
