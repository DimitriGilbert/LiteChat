// src/components/LiteChat/settings/SettingsTheme.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RotateCcwIcon, Check, ChevronsUpDown } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";
import { SettingsSection } from "../common/SettingsSection";
import type { CustomThemeColors, SettingsState } from "@/store/settings.store";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Helper component for color input
const ColorInput: React.FC<{
  label: string;
  colorKey: keyof CustomThemeColors;
  value: string | undefined | null;
  onChange: (key: keyof CustomThemeColors, value: string | null) => void;
}> = ({ label, colorKey, value, onChange }) => {
  const [localValue, setLocalValue] = useState(value ?? "");

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const handleBlur = () => {
    onChange(colorKey, localValue.trim() || null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={`color-${colorKey}`} className="text-xs w-28 shrink-0">
        {label}
      </Label>
      <Input
        id={`color-${colorKey}`}
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="h-8 text-xs flex-grow"
        placeholder="e.g., #ffffff or oklch(0.5 0.2 180)"
      />
      <Input
        type="color"
        value={localValue?.startsWith("#") ? localValue : "#000000"}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(colorKey, e.target.value);
        }}
        className="h-8 w-10 p-1 border-none cursor-pointer bg-transparent"
        aria-label={`Pick ${label} color`}
      />
    </div>
  );
};

// List of Prism themes
const PRISM_THEMES = [
  {
    name: "Default Light",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-light.min.css",
  },
  {
    name: "Default Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-coldark-dark.min.css",
  },
  {
    name: "A11y Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-a11y-dark.min.css",
  },
  {
    name: "Atom Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-atom-dark.min.css",
  },
  {
    name: "Atelier Sulphurpool Light",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-base16-ateliersulphurpool.light.min.css",
  },
  {
    name: "CB",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-cb.min.css",
  },
  {
    name: "Coldark Cold",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-coldark-cold.min.css",
  },
  {
    name: "Coy (No Shadow)",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-coy-without-shadows.min.css",
  },
  {
    name: "Darcula",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-darcula.min.css",
  },
  {
    name: "Dracula",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-dracula.min.css",
  },
  {
    name: "Duotone Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-duotone-dark.min.css",
  },
  {
    name: "Duotone Earth",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-duotone-earth.min.css",
  },
  {
    name: "Duotone Forest",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-duotone-forest.min.css",
  },
  {
    name: "Duotone Light",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-duotone-light.min.css",
  },
  {
    name: "Duotone Sea",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-duotone-sea.min.css",
  },
  {
    name: "Duotone Space",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-duotone-space.min.css",
  },
  {
    name: "GH Colors",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-ghcolors.min.css",
  },
  {
    name: "Gruvbox Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-gruvbox-dark.min.css",
  },
  {
    name: "Gruvbox Light",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-gruvbox-light.min.css",
  },
  {
    name: "Holi",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-holi-theme.min.css",
  },
  {
    name: "Hopscotch",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-hopscotch.min.css",
  },
  {
    name: "Lucario",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-lucario.min.css",
  },
  {
    name: "Material Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-dark.min.css",
  },
  {
    name: "Material Oceanic",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-material-oceanic.min.css",
  },
  {
    name: "Night Owl",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-night-owl.min.css",
  },
  {
    name: "Nord",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-nord.min.css",
  },
  {
    name: "One Dark",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-one-dark.min.css",
  },
  {
    name: "One Light",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-one-light.min.css",
  },
  {
    name: "Pojoaque",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-pojoaque.min.css",
  },
  {
    name: "Shades of Purple",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-shades-of-purple.min.css",
  },
  {
    name: "Solarized Dark Atom",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-solarized-dark-atom.min.css",
  },
  {
    name: "Synthwave '84",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-synthwave84.min.css",
  },
  {
    name: "VS",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-vs.min.css",
  },
  {
    name: "VSC Dark Plus",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-vsc-dark-plus.min.css",
  },
  {
    name: "Xonokai",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-xonokai.min.css",
  },
  {
    name: "Z-Touch",
    url: "https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-z-touch.min.css",
  },
];

const SettingsThemeComponent: React.FC = () => {
  const {
    theme,
    setTheme,
    prismThemeUrl,
    setPrismThemeUrl,
    customFontFamily,
    setCustomFontFamily,
    customFontSize,
    setCustomFontSize,
    chatMaxWidth,
    setChatMaxWidth,
    customThemeColors,
    setCustomThemeColor,
    resetThemeSettings,
  } = useSettingsStore(
    useShallow((state) => ({
      theme: state.theme,
      setTheme: state.setTheme,
      prismThemeUrl: state.prismThemeUrl,
      setPrismThemeUrl: state.setPrismThemeUrl,
      customFontFamily: state.customFontFamily,
      setCustomFontFamily: state.setCustomFontFamily,
      customFontSize: state.customFontSize,
      setCustomFontSize: state.setCustomFontSize,
      chatMaxWidth: state.chatMaxWidth,
      setChatMaxWidth: state.setChatMaxWidth,
      customThemeColors: state.customThemeColors,
      setCustomThemeColor: state.setCustomThemeColor,
      resetThemeSettings: state.resetThemeSettings,
    })),
  );

  const [localFontSize, setLocalFontSize] = useState(customFontSize ?? 16);
  const [prismPopoverOpen, setPrismPopoverOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState(
    PRISM_THEMES.some((t) => t.url === prismThemeUrl)
      ? ""
      : (prismThemeUrl ?? ""),
  );

  useEffect(() => {
    setLocalFontSize(customFontSize ?? 16);
  }, [customFontSize]);

  // Update customUrl input if prismThemeUrl changes externally and isn't a preset
  useEffect(() => {
    if (!PRISM_THEMES.some((t) => t.url === prismThemeUrl)) {
      setCustomUrl(prismThemeUrl ?? "");
    } else {
      setCustomUrl(""); // Clear if a preset is selected
    }
  }, [prismThemeUrl]);

  const handleFontSizeCommit = useCallback(
    (value: number[]) => {
      setCustomFontSize(value[0]);
    },
    [setCustomFontSize],
  );

  const handleResetClick = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all Theme settings to their defaults?",
      )
    ) {
      resetThemeSettings();
    }
  };

  const handlePrismThemeSelect = (url: string | null) => {
    setPrismThemeUrl(url);
    setCustomUrl(url ?? ""); // Update custom URL input as well
    setPrismPopoverOpen(false);
  };

  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomUrl(e.target.value);
    // Apply immediately if user types a custom URL
    setPrismThemeUrl(e.target.value.trim() || null);
  };

  const maxWidthOptions: { value: string; label: string }[] = [
    { value: "max-w-3xl", label: "Very Small (3xl)" },
    { value: "max-w-4xl", label: "Small (4xl)" },
    { value: "max-w-5xl", label: "Medium (5xl)" },
    { value: "max-w-6xl", label: "Large (6xl)" },
    { value: "max-w-7xl", label: "Very Large (7xl)" },
    { value: "max-w-full", label: "Full Width" },
  ];

  const colorKeys: { key: keyof CustomThemeColors; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "foreground", label: "Foreground" },
    { key: "card", label: "Card BG" },
    { key: "cardForeground", label: "Card FG" },
    { key: "popover", label: "Popover BG" },
    { key: "popoverForeground", label: "Popover FG" },
    { key: "primary", label: "Primary" },
    { key: "primaryForeground", label: "Primary FG" },
    { key: "secondary", label: "Secondary" },
    { key: "secondaryForeground", label: "Secondary FG" },
    { key: "muted", label: "Muted BG" },
    { key: "mutedForeground", label: "Muted FG" },
    { key: "accent", label: "Accent" },
    { key: "accentForeground", label: "Accent FG" },
    { key: "destructive", label: "Destructive" },
    { key: "destructiveForeground", label: "Destructive FG" },
    { key: "border", label: "Border" },
    { key: "input", label: "Input BG" },
    { key: "ring", label: "Ring (Focus)" },
    { key: "sidebar", label: "Sidebar BG" },
    { key: "sidebarForeground", label: "Sidebar FG" },
    { key: "sidebarPrimary", label: "Sidebar Primary" },
    { key: "sidebarPrimaryForeground", label: "Sidebar Primary FG" },
    { key: "sidebarAccent", label: "Sidebar Accent" },
    { key: "sidebarAccentForeground", label: "Sidebar Accent FG" },
    { key: "sidebarBorder", label: "Sidebar Border" },
    { key: "sidebarRing", label: "Sidebar Ring" },
    { key: "chart1", label: "Chart 1" },
    { key: "chart2", label: "Chart 2" },
    { key: "chart3", label: "Chart 3" },
    { key: "chart4", label: "Chart 4" },
    { key: "chart5", label: "Chart 5" },
  ];

  const selectedThemeName =
    PRISM_THEMES.find((t) => t.url === prismThemeUrl)?.name ??
    (prismThemeUrl ? "Custom URL" : "Default (Matches Theme)");

  return (
    <div className="space-y-6 p-1">
      {/* Base Theme Selection */}
      <SettingsSection
        title="Base Theme"
        description="Select the overall look and feel."
        contentClassName="rounded-lg border p-4 shadow-sm bg-card"
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="theme-select" className="font-medium">
            Theme
          </Label>
          <Select
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(value as SettingsState["theme"])}
          >
            <SelectTrigger id="theme-select" className="w-[180px]">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Default Light</SelectItem>
              <SelectItem value="dark">Default Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="TijuLight">Tiju Light</SelectItem>
              <SelectItem value="TijuDark">Tiju Dark</SelectItem>
              <SelectItem value="custom">User Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SettingsSection>

      {/* Font & Layout */}
      <SettingsSection
        title="Font & Layout"
        description="Customize typography and content width."
        contentClassName="rounded-lg border p-4 shadow-sm bg-card space-y-4"
      >
        <div>
          <Label htmlFor="custom-font-family">Custom Font Family</Label>
          <Input
            id="custom-font-family"
            value={customFontFamily ?? ""}
            onChange={(e) => setCustomFontFamily(e.target.value || null)}
            placeholder="e.g., 'Inter', sans-serif (Leave blank for default)"
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Applies only when 'User Custom' theme is selected. Ensure the font
            is available (system or web font).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-font-size">
            Base Font Size ({localFontSize}px)
          </Label>
          <Slider
            id="custom-font-size"
            min={12}
            max={20}
            step={1}
            value={[localFontSize]}
            onValueChange={(v) => setLocalFontSize(v[0])}
            onValueCommit={handleFontSizeCommit}
          />
          <p className="text-xs text-muted-foreground">
            Applies only when 'User Custom' theme is selected. Affects base text
            size (Default: 16px).
          </p>
        </div>
        <div>
          <Label htmlFor="chat-max-width">Chat Content Max Width</Label>
          <Select
            value={chatMaxWidth ?? "max-w-7xl"}
            onValueChange={(value) => setChatMaxWidth(value || null)}
          >
            <SelectTrigger id="chat-max-width" className="w-full mt-1">
              <SelectValue placeholder="Select max width" />
            </SelectTrigger>
            <SelectContent>
              {maxWidthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Controls the maximum width of the main chat message area.
          </p>
        </div>
      </SettingsSection>

      {/* Code Block Theme */}
      <SettingsSection
        title="Code Block Theme"
        description="Customize syntax highlighting appearance."
        contentClassName="rounded-lg border p-4 shadow-sm bg-card space-y-3"
      >
        <Label htmlFor="prism-theme-select">Select Theme or Enter URL</Label>
        <Popover open={prismPopoverOpen} onOpenChange={setPrismPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              id="prism-theme-select"
              variant="outline"
              role="combobox"
              aria-expanded={prismPopoverOpen}
              className="w-full justify-between"
            >
              <span className="truncate">{selectedThemeName}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search theme or enter URL..." />
              <CommandList>
                <CommandEmpty>No theme found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    key="default"
                    value="Default (Matches Theme)"
                    onSelect={() => handlePrismThemeSelect(null)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        prismThemeUrl === null ? "opacity-100" : "opacity-0",
                      )}
                    />
                    Default (Matches Theme)
                  </CommandItem>
                  {PRISM_THEMES.map((themeOption) => (
                    <CommandItem
                      key={themeOption.url}
                      value={themeOption.name}
                      onSelect={() => handlePrismThemeSelect(themeOption.url)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          prismThemeUrl === themeOption.url
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      {themeOption.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          id="prism-theme-url-custom"
          type="url"
          placeholder="Or paste custom theme URL here..."
          value={customUrl}
          onChange={handleCustomUrlChange}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Select a preset theme or paste a URL to a PrismJS CSS file. Leave
          blank or select 'Default' to use themes matching light/dark mode.
        </p>
      </SettingsSection>

      {/* Custom Theme Colors */}
      <SettingsSection
        title="Custom Theme Colors"
        description="Define custom colors. Applies only when 'User Custom' theme is selected. Use valid CSS color values (hex, rgb, oklch, etc.). Leave blank to use default light/dark theme colors."
        contentClassName="rounded-lg border p-4 shadow-sm bg-card"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          {colorKeys.map(({ key, label }) => (
            <ColorInput
              key={key}
              label={label}
              colorKey={key}
              value={customThemeColors?.[key]}
              onChange={setCustomThemeColor}
            />
          ))}
        </div>
      </SettingsSection>

      {/* Reset Button */}
      <Separator />
      <div className="flex justify-end pt-4">
        <Button variant="outline" size="sm" onClick={handleResetClick}>
          <RotateCcwIcon className="mr-2 h-4 w-4" />
          Reset Theme Settings
        </Button>
      </div>
    </div>
  );
};

export const SettingsTheme = React.memo(SettingsThemeComponent);
