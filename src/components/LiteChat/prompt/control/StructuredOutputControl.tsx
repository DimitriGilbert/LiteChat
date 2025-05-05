// src/components/LiteChat/prompt/control/StructuredOutputControl.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeIcon, SaveIcon, Trash2Icon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TabbedLayout, TabDefinition } from "../../common/TabbedLayout";
import { usePromptStateStore } from "@/store/prompt.store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

// Placeholder for library items - needs proper state management/persistence
interface StructuredOutputItem {
  id: string;
  name: string;
  json: string;
}

// Define the component as a value using React.FC
export const StructuredOutputControl: React.FC = () => {
  const { structuredOutputJson, setStructuredOutputJson } = usePromptStateStore(
    useShallow((state) => ({
      structuredOutputJson: state.structuredOutputJson,
      setStructuredOutputJson: state.setStructuredOutputJson,
    })),
  );

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [entryJson, setEntryJson] = useState(structuredOutputJson ?? "");
  const [entryName, setEntryName] = useState("");
  const [libraryItems, setLibraryItems] = useState<StructuredOutputItem[]>([]);

  const handleApply = useCallback(() => {
    try {
      // Validate JSON before applying
      JSON.parse(entryJson);
      setStructuredOutputJson(entryJson.trim() || null);
      setPopoverOpen(false);
      toast.success("Structured output applied for next turn.");
    } catch (e) {
      toast.error("Invalid JSON format.");
    }
  }, [entryJson, setStructuredOutputJson]);

  const handleClear = useCallback(() => {
    setEntryJson("");
    setStructuredOutputJson(null);
    setPopoverOpen(false);
    toast.info("Structured output cleared.");
  }, [setStructuredOutputJson]);

  const handleSaveToLibrary = useCallback(() => {
    if (!entryName.trim()) {
      toast.error("Please provide a name to save to the library.");
      return;
    }
    try {
      JSON.parse(entryJson);
      const newItem: StructuredOutputItem = {
        id: Date.now().toString(),
        name: entryName.trim(),
        json: entryJson,
      };
      setLibraryItems((prev) => [...prev, newItem]);
      setEntryName("");
      toast.success(`"${newItem.name}" saved to library.`);
      // TODO: Persist libraryItems
    } catch (e) {
      toast.error("Cannot save invalid JSON to library.");
    }
  }, [entryJson, entryName]);

  const handleUseFromLibrary = useCallback(
    (item: StructuredOutputItem) => {
      setEntryJson(item.json);
      setStructuredOutputJson(item.json);
      setPopoverOpen(false);
      toast.success(`Loaded "${item.name}" from library.`);
    },
    [setStructuredOutputJson],
  );

  const handleDeleteFromLibrary = useCallback((id: string) => {
    setLibraryItems((prev) => prev.filter((item) => item.id !== id));
    toast.info("Item removed from library.");
    // TODO: Update persisted libraryItems
  }, []);

  // Reset entryJson when popover opens if it differs from store
  useEffect(() => {
    if (popoverOpen) {
      setEntryJson(structuredOutputJson ?? "");
    }
  }, [popoverOpen, structuredOutputJson]);

  const tabs: TabDefinition[] = [
    {
      value: "entry",
      label: "Entry",
      content: (
        <div className="space-y-3 p-1">
          <Label htmlFor="structured-output-entry">JSON Output Schema</Label>
          <Textarea
            id="structured-output-entry"
            placeholder='e.g., {"type": "object", "properties": {"name": {"type": "string"}}}'
            value={entryJson}
            onChange={(e) => setEntryJson(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
          <div className="flex justify-between items-end gap-2">
            <div className="flex-grow space-y-1">
              <Label htmlFor="structured-output-name" className="text-xs">
                Save to Library (Optional Name)
              </Label>
              <Input
                id="structured-output-name"
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
                placeholder="Schema Name"
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveToLibrary}
              disabled={!entryName.trim() || !entryJson.trim()}
              className="h-8"
            >
              <SaveIcon className="h-3.5 w-3.5 mr-1" /> Save
            </Button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={!structuredOutputJson}
            >
              Clear Applied Schema
            </Button>
            <Button size="sm" onClick={handleApply} disabled={!entryJson}>
              Apply for Next Turn
            </Button>
          </div>
        </div>
      ),
    },
    {
      value: "library",
      label: "Library",
      content: (
        <div className="space-y-2 p-1">
          {libraryItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No saved schemas yet.
            </p>
          ) : (
            libraryItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
              >
                <span className="text-sm font-medium truncate flex-grow mr-2">
                  {item.name}
                </span>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUseFromLibrary(item)}
                    className="h-7 px-2 text-xs"
                  >
                    Use
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteFromLibrary(item.id)}
                    className="h-7 w-7 text-destructive"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      ),
    },
  ];

  const isApplied = !!structuredOutputJson;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={isApplied ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                aria-label="Set Structured Output"
              >
                <CodeIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isApplied
              ? "Structured Output Active"
              : "Set Structured Output (JSON Schema)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-[450px] p-0" align="start">
        <TabbedLayout tabs={tabs} defaultValue="entry" />
      </PopoverContent>
    </Popover>
  );
};
