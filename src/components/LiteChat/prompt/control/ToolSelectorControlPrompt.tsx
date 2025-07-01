// src/components/LiteChat/prompt/control/ToolSelectorControlPrompt.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ToolSelectorControlComponentProps {
  enabledTools: Set<string>;
  setEnabledTools: (updater: (prev: Set<string>) => Set<string>) => void;
  className?: string;
}

export const ToolSelectorControlComponent: React.FC<
  ToolSelectorControlComponentProps
> = ({ enabledTools, setEnabledTools, className }) => {
  const { t } = useTranslation('prompt');
  const allTools = useControlRegistryStore((state) => state.tools);
  const [filterText, setFilterText] = useState("");

  const availableTools = useMemo(() => {
    return Object.entries(allTools)
      .map(([name, { definition, modId }]) => ({
        name,
        description: definition.description ?? t('toolSelector.noDescription'),
        modId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTools, t]);

  const filteredTools = useMemo(() => {
    if (!filterText.trim()) {
      return availableTools;
    }
    const lowerFilter = filterText.toLowerCase();
    return availableTools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerFilter) ||
        tool.description.toLowerCase().includes(lowerFilter) ||
        tool.modId.toLowerCase().includes(lowerFilter),
    );
  }, [availableTools, filterText]);

  const handleToggle = useCallback(
    (toolName: string, checked: boolean) => {
      setEnabledTools((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(toolName);
        } else {
          next.delete(toolName);
        }
        return next;
      });
    },
    [setEnabledTools],
  );

  const handleToggleAll = useCallback(
    (enable: boolean) => {
      setEnabledTools(() => {
        if (enable) {
          return new Set(availableTools.map((t) => t.name));
        } else {
          return new Set();
        }
      });
    },
    [availableTools, setEnabledTools],
  );

  return (
    <div className={cn("p-4 w-96 space-y-3", className)}>
      <h4 className="text-sm font-medium">{t('toolSelector.title')}</h4>
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t('toolSelector.filterPlaceholder')}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="pl-8 h-9"
        />
      </div>
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground">
          {t('toolSelector.toolsShown', { count: filteredTools.length })}
        </Label>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm" // Changed from 'xs'
            onClick={() => handleToggleAll(true)}
            disabled={availableTools.length === 0}
          >
            {t('toolSelector.enableAll')}
          </Button>
          <Button
            variant="outline"
            size="sm" // Changed from 'xs'
            onClick={() => handleToggleAll(false)}
            disabled={availableTools.length === 0 || enabledTools.size === 0}
          >
            {t('toolSelector.disableAll')}
          </Button>
        </div>
      </div>
      <ScrollArea className="h-64 border rounded-md p-2 bg-background/50">
        {availableTools.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('toolSelector.noToolsRegistered')}
          </p>
        ) : filteredTools.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('toolSelector.noToolsMatchFilter')}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredTools.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between p-1.5 rounded hover:bg-muted"
              >
                <Label
                  htmlFor={`tool-switch-${tool.name}`}
                  className="text-sm font-normal flex-grow cursor-pointer mr-2 space-y-0.5"
                  title={`${tool.name} (from ${tool.modId})`}
                >
                  <span className="block truncate font-medium">
                    {tool.name}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {tool.description}
                  </span>
                </Label>
                <Switch
                  id={`tool-switch-${tool.name}`}
                  checked={enabledTools.has(tool.name)}
                  onCheckedChange={(checked) =>
                    handleToggle(tool.name, checked)
                  }
                  className="flex-shrink-0"
                />
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
