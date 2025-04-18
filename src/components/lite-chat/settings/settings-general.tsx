// src/components/lite-chat/settings-general.tsx
import React, { useState } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SunIcon, MoonIcon, LaptopIcon, GitBranchIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export const SettingsGeneral: React.FC = () => {
  const { theme, setTheme, updateDbMod } = useChatContext();

  // Git repository settings states
  const [rootGitEnabled, setRootGitEnabled] = useState(false);
  const [rootGitRepoUrl, setRootGitRepoUrl] = useState("");
  const [rootGitRepoBranch, setRootGitRepoBranch] = useState("main");
  const [isSaving, setIsSaving] = useState(false);

  // Save root git repository configuration
  const handleSaveRootGitConfig = async () => {
    if (!rootGitRepoUrl && rootGitEnabled) {
      toast.error("Please enter a repository URL");
      return;
    }

    setIsSaving(true);
    try {
      // Here you would save the configuration to your database
      // This is a placeholder as we need to implement the actual storage
      // which would depend on how you store global settings
      // Store configuration in the scriptContent field as JSON
      await updateDbMod("root-git-config", {
        name: "Root Git Configuration",
        enabled: true,
        scriptContent: JSON.stringify({
          gitRepoEnabled: rootGitEnabled,
          gitRepoUrl: rootGitRepoUrl,
          gitRepoBranch: rootGitRepoBranch || "main",
        }),
        sourceUrl: null,
      });
      toast.success("Git repository configuration saved");
    } catch (error) {
      console.error("Failed to save git configuration:", error);
      toast.error("Failed to save git configuration");
    } finally {
      setIsSaving(false);
    }
  };

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

      <Separator />

      {/* Git Repository Configuration for Root Conversations */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">
            Sync root conversations with Git Repository
          </h3>
          <div className="flex items-center space-x-2">
            <Switch
              id="root-git-enabled"
              checked={rootGitEnabled}
              onCheckedChange={setRootGitEnabled}
            />
            <Label htmlFor="root-git-enabled" className="cursor-pointer">
              {rootGitEnabled ? "Enabled" : "Disabled"}
            </Label>
          </div>
        </div>

        <div className={rootGitEnabled ? "" : "opacity-50 pointer-events-none"}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="root-git-repo-url">Repository URL</Label>
              <div className="flex items-center gap-2">
                <GitBranchIcon className="h-4 w-4 text-gray-500" />
                <Input
                  id="root-git-repo-url"
                  placeholder="https://github.com/username/repo.git"
                  value={rootGitRepoUrl}
                  onChange={(e) => setRootGitRepoUrl(e.target.value)}
                  disabled={!rootGitEnabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="root-git-repo-branch">Branch</Label>
              <Input
                id="root-git-repo-branch"
                placeholder="main"
                value={rootGitRepoBranch}
                onChange={(e) => setRootGitRepoBranch(e.target.value)}
                disabled={!rootGitEnabled}
              />
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSaveRootGitConfig}
                disabled={!rootGitEnabled || isSaving || !rootGitRepoUrl}
                className="w-full"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                This configuration will apply to all root conversations that
                don't have their own specific git repository settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
