// src/components/LiteChat/settings/SettingsTheme.tsx
// FULL FILE - Updated max width options to use Tailwind classes
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
import { RotateCcwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { Separator } from "@/components/ui/separator";
import { SettingsSection } from "../common/SettingsSection";
import type { CustomThemeColors, SettingsState } from "@/store/settings.store";

// Helper component for color input (remains the same)
const ColorInput: React.FC<{
  label: string;
  colorKey: keyof CustomThemeColors;
  value: string | undefined;
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
        value={localValue.startsWith("#") ? localValue : "#000000"}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChange(colorKey, e.target.value);
        }}
        className="h-8 w-10 p-1 border-none cursor-pointer"
        aria-label={`Pick ${label} color`}
      />
    </div>
  );
};

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
    chatMaxWidth, // This is the Tailwind class string (e.g., 'max-w-7xl')
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

  useEffect(() => {
    setLocalFontSize(customFontSize ?? 16);
  }, [customFontSize]);

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

  // Map Tailwind classes to user-friendly labels
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
  ];

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
            onValueChange={
              (value) => setTheme(value as SettingsState["theme"]) // Use imported type
            }
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
            onChange={(e) => setCustomFontFamily(e.target.value)}
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
            value={chatMaxWidth ?? "max-w-7xl"} // Use stored class, default
            onValueChange={(value) => setChatMaxWidth(value || null)} // Pass class string or null
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
        contentClassName="rounded-lg border p-4 shadow-sm bg-card"
      >
        <Label htmlFor="prism-theme-url">Theme URL (Optional)</Label>
        <Input
          id="prism-theme-url"
          type="url"
          placeholder="e.g., https://.../prism-okaidia.min.css"
          value={prismThemeUrl ?? ""}
          onChange={(e) => setPrismThemeUrl(e.target.value)}
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Enter the URL of a PrismJS CSS theme file (e.g., from cdnjs). Leave
          blank to use default themes matching light/dark mode.
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
