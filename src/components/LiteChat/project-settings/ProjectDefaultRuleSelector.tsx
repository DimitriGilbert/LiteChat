// src/components/LiteChat/project-settings/ProjectDefaultRuleSelector.tsx
// FULL FILE
import React, { useState, useMemo } from "react";
import type { DbRule } from "@/types/litechat/rules";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";

interface ProjectDefaultRuleSelectorProps {
  allRules: DbRule[];
  selectedRuleIds: Set<string>;
  onSelectionChange: (ruleId: string, selected: boolean) => void;
  disabled?: boolean;
}

export const ProjectDefaultRuleSelector: React.FC<
  ProjectDefaultRuleSelectorProps
> = ({ allRules, selectedRuleIds, onSelectionChange, disabled = false }) => {
  const [filterText, setFilterText] = useState("");

  const filteredRules = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();
    if (!lowerFilter) return allRules;
    return allRules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerFilter) ||
        rule.content.toLowerCase().includes(lowerFilter) ||
        rule.type.toLowerCase().includes(lowerFilter),
    );
  }, [allRules, filterText]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter rules..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="pl-8 h-9"
          disabled={disabled}
        />
      </div>
      <ScrollArea className="h-48 border rounded-md p-2 bg-background/50">
        {filteredRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {allRules.length === 0
              ? "No rules defined globally."
              : "No rules match filter."}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-start justify-between p-1.5 rounded hover:bg-muted"
              >
                <div className="flex items-center space-x-2 flex-grow mr-2">
                  <Checkbox
                    id={`project-default-rule-${rule.id}`}
                    checked={selectedRuleIds.has(rule.id)}
                    onCheckedChange={(checked) =>
                      onSelectionChange(rule.id, !!checked)
                    }
                    className="mt-0.5"
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`project-default-rule-${rule.id}`}
                    className="text-sm font-normal cursor-pointer space-y-0.5"
                  >
                    <span className="block font-medium">{rule.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      Type: {rule.type}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate max-w-xs">
                      Content: {rule.content}
                    </span>
                  </Label>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
