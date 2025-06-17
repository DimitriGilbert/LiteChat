// src/components/LiteChat/settings/tags/TagRuleLinker.tsx
// FULL FILE
import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import type { DbRule, DbTag } from "@/types/litechat/rules";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const sortedRules = useMemo(
    () => [...allRules].sort((a, b) => a.name.localeCompare(b.name)),
    [allRules]
  );

  const filteredRules = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();
    if (!lowerFilter) return sortedRules;
    return sortedRules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerFilter) ||
        rule.content.toLowerCase().includes(lowerFilter) ||
        rule.type.toLowerCase().includes(lowerFilter)
    );
  }, [sortedRules, filterText]);

  const handleSelect = useCallback(
    (ruleId: string) => {
      const isCurrentlyLinked = linkedRuleIds.has(ruleId);
      onLinkChange(tag.id, ruleId, !isCurrentlyLinked);
      setFilterText("");
    },
    [linkedRuleIds, onLinkChange, tag.id]
  );

  const handleUnlink = useCallback(
    (ruleId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onLinkChange(tag.id, ruleId, false);
    },
    [onLinkChange, tag.id]
  );

  const selectedRules = useMemo(() => {
    return sortedRules.filter((rule) => linkedRuleIds.has(rule.id));
  }, [sortedRules, linkedRuleIds]);

  return (
    <div className="space-y-3">
      <Label className="font-medium">Associated Rules for "{tag.name}"</Label>
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between h-9"
          disabled={disabled || allRules.length === 0}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">
            {selectedRules.length > 0
              ? `${selectedRules.length} rule(s) selected`
              : "Select rules..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-[var(--z-popover)] mt-1 rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="p-2">
              <Input
                placeholder="Search rules..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-48 overflow-auto">
              {filteredRules.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {allRules.length === 0 ? "No rules defined." : "No rules found."}
                </div>
              ) : (
                filteredRules.map((rule) => {
                  const isSelected = linkedRuleIds.has(rule.id);
                  return (
                    <div
                      key={rule.id}
                      onClick={() => handleSelect(rule.id)}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{rule.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({rule.type})
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

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
