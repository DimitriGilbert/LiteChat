// src/components/LiteChat/settings/tags/TagRuleLinker.tsx
// FULL FILE
import React, { useMemo, useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import type { DbRule, DbTag } from "@/types/litechat/rules";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, XIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagRuleLinkerProps {
  tag: DbTag;
  allRules: DbRule[];
  linkedRuleIds: Set<string>;
  onLinkChange: (tagId: string, ruleId: string, isLinked: boolean) => void;
  disabled?: boolean;
}

export const TagRuleLinker: React.FC<TagRuleLinkerProps> = ({
  tag,
  allRules,
  linkedRuleIds,
  onLinkChange,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");

  const sortedRules = useMemo(
    () => [...allRules].sort((a, b) => a.name.localeCompare(b.name)),
    [allRules],
  );

  const filteredRules = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();
    if (!lowerFilter) return sortedRules;
    return sortedRules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerFilter) ||
        rule.content.toLowerCase().includes(lowerFilter) ||
        rule.type.toLowerCase().includes(lowerFilter),
    );
  }, [sortedRules, filterText]);

  const handleSelect = useCallback(
    (ruleId: string) => {
      const isCurrentlyLinked = linkedRuleIds.has(ruleId);
      onLinkChange(tag.id, ruleId, !isCurrentlyLinked);
      // Keep popover open after selection
      // setOpen(false);
      setFilterText(""); // Clear filter after selection
    },
    [linkedRuleIds, onLinkChange, tag.id],
  );

  const handleUnlink = useCallback(
    (ruleId: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent badge click from triggering combobox
      onLinkChange(tag.id, ruleId, false);
    },
    [onLinkChange, tag.id],
  );

  const selectedRules = useMemo(() => {
    return sortedRules.filter((rule) => linkedRuleIds.has(rule.id));
  }, [sortedRules, linkedRuleIds]);

  return (
    <div className="space-y-3">
      <Label className="font-medium">Associated Rules for "{tag.name}"</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9"
            disabled={disabled || allRules.length === 0}
          >
            <span className="truncate">
              {selectedRules.length > 0
                ? `${selectedRules.length} rule(s) selected`
                : "Select rules..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search rules..."
              value={filterText}
              onValueChange={setFilterText}
            />
            <CommandList>
              <CommandEmpty>
                {allRules.length === 0
                  ? "No rules defined."
                  : "No rules found."}
              </CommandEmpty>
              <CommandGroup>
                {filteredRules.map((rule) => {
                  const isSelected = linkedRuleIds.has(rule.id);
                  return (
                    <CommandItem
                      key={rule.id}
                      value={rule.id} // Use ID for value
                      onSelect={() => handleSelect(rule.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{rule.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({rule.type})
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Display selected rules as badges */}
      {selectedRules.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2">
          {selectedRules.map((rule) => (
            <Badge
              key={rule.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <span className="truncate">{rule.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                onClick={(e) => handleUnlink(rule.id, e)}
                disabled={disabled}
                aria-label={`Unlink rule ${rule.name}`}
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
