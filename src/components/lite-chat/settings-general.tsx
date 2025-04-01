// src/components/lite-chat/settings-general.tsx
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SunIcon, MoonIcon, LaptopIcon } from "lucide-react"; // Icons for theme

export const SettingsGeneral: React.FC = () => {
  const { theme, setTheme } = useChatContext();

  return (
    <div className="space-y-6 p-1">
      {/* Theme Selection */}
      <div>
        <h3 className="text-lg font-medium mb-2">Appearance</h3>
        <Label className="text-sm mb-3 block">Theme</Label>
        <RadioGroup
          value={theme}
          onValueChange={(value: "light" | "dark" | "system") =>
            setTheme(value)
          }
          className="flex flex-col sm:flex-row gap-4"
        >
          <Label
            htmlFor="theme-light"
            className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
          >
            <RadioGroupItem value="light" id="theme-light" />
            <SunIcon className="h-4 w-4" />
            Light
          </Label>
          <Label
            htmlFor="theme-dark"
            className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
          >
            <RadioGroupItem value="dark" id="theme-dark" />
            <MoonIcon className="h-4 w-4" />
            Dark
          </Label>
          <Label
            htmlFor="theme-system"
            className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
          >
            <RadioGroupItem value="system" id="theme-system" />
            <LaptopIcon className="h-4 w-4" />
            System
          </Label>
        </RadioGroup>
      </div>

      {/* Add other general settings here if needed */}
      {/* Example:
      <div>
        <h3 className="text-lg font-medium mb-2">Feature Toggles</h3>
        <div className="flex items-center space-x-2">
          <Switch id="some-feature" />
          <Label htmlFor="some-feature">Enable Experimental Feature X</Label>
        </div>
      </div>
      */}
    </div>
  );
};
