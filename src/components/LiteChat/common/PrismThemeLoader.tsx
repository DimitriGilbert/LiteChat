// src/components/LiteChat/common/PrismThemeLoader.tsx
// FULL FILE
import { useEffect, useMemo } from "react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

const PRISM_THEME_LINK_ID = "prism-theme-link";
const DEFAULT_LIGHT_THEME_LINK_ID = "prism-default-light-theme-link";
const DEFAULT_DARK_THEME_LINK_ID = "prism-default-dark-theme-link";

const DEFAULT_LIGHT_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-light.min.css";
const DEFAULT_DARK_THEME_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-coldark-dark.min.css";

// Helper to ensure link exists and set attributes
const ensureLinkElement = (id: string, url: string): HTMLLinkElement => {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    // Append early to establish order
    document.head.appendChild(link);
  }
  if (link.href !== url) {
    link.href = url;
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
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  }, []);

  const currentThemeMode = useMemo(() => {
    const effectiveTheme = appTheme === "system" ? systemTheme : appTheme;
    if (effectiveTheme === "dark" || effectiveTheme === "TijuDark") {
      return "dark";
    }
    return "light";
  }, [appTheme, systemTheme]);

  useEffect(() => {
    // Ensure default links exist first to control load order
    const lightLink = ensureLinkElement(
      DEFAULT_LIGHT_THEME_LINK_ID,
      DEFAULT_LIGHT_THEME_URL,
    );
    const darkLink = ensureLinkElement(
      DEFAULT_DARK_THEME_LINK_ID,
      DEFAULT_DARK_THEME_URL,
    );
    let customLink = document.getElementById(
      PRISM_THEME_LINK_ID,
    ) as HTMLLinkElement | null;

    if (prismThemeUrl) {
      // Load or update custom theme
      customLink = ensureLinkElement(PRISM_THEME_LINK_ID, prismThemeUrl);
      customLink.disabled = false;
      // Disable defaults
      lightLink.disabled = true;
      darkLink.disabled = true;
    } else {
      // Disable custom theme if it exists
      if (customLink) {
        customLink.disabled = true;
      }
      // Enable the correct default theme
      if (currentThemeMode === "dark") {
        darkLink.disabled = false;
        lightLink.disabled = true;
      } else {
        lightLink.disabled = false;
        darkLink.disabled = true;
      }
    }
  }, [prismThemeUrl, currentThemeMode]);

  return null;
};
