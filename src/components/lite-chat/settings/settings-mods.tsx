// src/components/lite-chat/settings-mods.tsx
import React, { useState, useCallback } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DbMod } from "@/mods/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components

export const SettingsMods: React.FC = () => {
  const { dbMods, loadedMods, addDbMod, updateDbMod, deleteDbMod } =
    useChatContext();

  const [modName, setModName] = useState("");
  const [modUrl, setModUrl] = useState("");
  const [modScript, setModScript] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const handleAddMod = useCallback(async () => {
    if (!modName.trim()) {
      toast.error("Mod name cannot be empty.");
      return;
    }
    if (!modUrl.trim() && !modScript.trim()) {
      toast.error("Either Mod URL or Script Content must be provided.");
      return;
    }
    if (modUrl.trim() && modScript.trim()) {
      toast.error("Provide either a Mod URL or Script Content, not both.");
      return;
    }

    setIsAdding(true);
    try {
      const modData: Omit<DbMod, "id" | "createdAt"> = {
        name: modName.trim(),
        sourceUrl: modUrl.trim() || null,
        scriptContent: modScript.trim() || null,
        enabled: true, // Enable by default
        loadOrder: (dbMods.length + 1) * 10, // Simple load order increment
      };
      await addDbMod(modData);
      toast.success(`Mod "${modName.trim()}" added successfully.`);
      setModName("");
      setModUrl("");
      setModScript("");
    } catch (error) {
      console.error("Failed to add mod:", error);
      toast.error(
        `Failed to add mod: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsAdding(false);
    }
  }, [modName, modUrl, modScript, addDbMod, dbMods.length]);

  const handleToggleEnable = useCallback(
    async (mod: DbMod) => {
      setIsUpdating((prev) => ({ ...prev, [mod.id]: true }));
      try {
        await updateDbMod(mod.id, { enabled: !mod.enabled });
        toast.info(
          `Mod "${mod.name}" ${!mod.enabled ? "enabled" : "disabled"}. Reload required for changes to take effect.`,
        );
      } catch (error) {
        console.error("Failed to update mod:", error);
        toast.error(
          `Failed to update mod status: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsUpdating((prev) => ({ ...prev, [mod.id]: false }));
      }
    },
    [updateDbMod],
  );

  const handleDeleteMod = useCallback(
    async (mod: DbMod) => {
      if (
        !window.confirm(
          `Are you sure you want to delete the mod "${mod.name}"? This cannot be undone.`,
        )
      ) {
        return;
      }
      setIsDeleting((prev) => ({ ...prev, [mod.id]: true }));
      try {
        await deleteDbMod(mod.id);
        toast.success(`Mod "${mod.name}" deleted successfully.`);
      } catch (error) {
        console.error("Failed to delete mod:", error);
        toast.error(
          `Failed to delete mod: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsDeleting((prev) => ({ ...prev, [mod.id]: false }));
      }
    },
    [deleteDbMod],
  );

  const getModStatus = (
    modId: string,
  ): { status: string; error?: string | Error; tooltip?: string } => {
    const loaded = loadedMods.find((m) => m.id === modId);
    if (loaded) {
      if (loaded.error) {
        const errorMessage =
          loaded.error instanceof Error
            ? loaded.error.message
            : String(loaded.error);
        return { status: "Error", error: loaded.error, tooltip: errorMessage };
      } else {
        return { status: "Loaded" };
      }
    }
    // Check if it exists in dbMods but not loaded
    const dbMod = dbMods.find((m) => m.id === modId);
    if (!dbMod) {
      return { status: "Unknown" }; // Should not happen if called from map
    }
    return dbMod.enabled
      ? { status: "Load Pending" } // Mod is enabled but not yet in loadedMods (app loading?)
      : { status: "Disabled" }; // Mod exists but is disabled
  };

  return (
    <div className="space-y-6 p-1">
      <Alert variant="destructive" className="border-destructive/50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Security Warning</AlertTitle>
        <AlertDescription>
          Running mods from untrusted sources can compromise your security and
          privacy. Mods execute arbitrary JavaScript code within LiteChat and
          can potentially access sensitive data like API keys stored in the
          browser or interact with external services. Only install mods you
          trust. LiteChat is not responsible for any damage caused by mods.
        </AlertDescription>
      </Alert>

      <div className="space-y-4 rounded-md border p-4">
        <h3 className="text-lg font-medium">Add New Mod</h3>
        <div className="space-y-2">
          <Label htmlFor="mod-name">Mod Name</Label>
          <Input
            id="mod-name"
            value={modName}
            onChange={(e) => setModName(e.target.value)}
            placeholder="My Awesome Mod"
            disabled={isAdding}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mod-url">Source URL (Optional)</Label>
          <Input
            id="mod-url"
            type="url"
            value={modUrl}
            onChange={(e) => setModUrl(e.target.value)}
            placeholder="https://example.com/my-mod.js"
            disabled={isAdding || !!modScript.trim()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mod-script">Script Content (Optional)</Label>
          <Textarea
            id="mod-script"
            value={modScript}
            onChange={(e) => setModScript(e.target.value)}
            placeholder="/* Paste your mod script here */"
            className="min-h-[100px] font-mono text-xs"
            disabled={isAdding || !!modUrl.trim()}
          />
        </div>
        <Button onClick={handleAddMod} disabled={isAdding}>
          {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isAdding ? "Adding..." : "Add Mod"}
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Installed Mods</h3>
        <p className="text-sm text-muted-foreground">
          Enable or disable mods below. A page reload is required for changes to
          fully take effect.
        </p>
        <div className="rounded-md border">
          <TooltipProvider delayDuration={100}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dbMods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No mods installed yet.
                    </TableCell>
                  </TableRow>
                )}
                {dbMods.map((mod) => {
                  const { status, error, tooltip } = getModStatus(mod.id);
                  const sourceDisplay = mod.sourceUrl
                    ? new URL(mod.sourceUrl).hostname
                    : "Direct Script";
                  const isModUpdating = isUpdating[mod.id];
                  const isModDeleting = isDeleting[mod.id];
                  const isDisabled = isModUpdating || isModDeleting;
                  const hasError = status === "Error";

                  return (
                    <TableRow key={mod.id}>
                      <TableCell className="font-medium">{mod.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sourceDisplay}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={
                                hasError
                                  ? "text-destructive font-semibold cursor-help"
                                  : ""
                              }
                            >
                              {status}
                            </span>
                          </TooltipTrigger>
                          {tooltip && (
                            <TooltipContent className="max-w-xs break-words">
                              <p>{tooltip}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {hasError && error && (
                          <p className="text-xs text-destructive truncate">
                            {error instanceof Error
                              ? error.message
                              : String(error)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={mod.enabled}
                          onCheckedChange={() => handleToggleEnable(mod)}
                          disabled={isDisabled}
                          aria-label={`Enable ${mod.name}`}
                        />
                        {isModUpdating && (
                          <Loader2 className="h-4 w-4 animate-spin inline-block ml-2" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMod(mod)}
                          disabled={isDisabled}
                          aria-label={`Delete ${mod.name}`}
                          className="text-destructive hover:text-destructive/80"
                        >
                          {isModDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
