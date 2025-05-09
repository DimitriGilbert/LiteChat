// src/components/LiteChat/project-settings/ProjectDefaultTagSelector.tsx
// FULL FILE
import React, { useState, useMemo } from "react";
import type { DbTag } from "@/types/litechat/rules";
import { useRulesStore } from "@/store/rules.store"; // Needed for getRulesForTag
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";

interface ProjectDefaultTagSelectorProps {
  allTags: DbTag[];
  selectedTagIds: Set<string>;
  onSelectionChange: (tagId: string, selected: boolean) => void;
  disabled?: boolean;
}

export const ProjectDefaultTagSelector: React.FC<
  ProjectDefaultTagSelectorProps
> = ({ allTags, selectedTagIds, onSelectionChange, disabled = false }) => {
  const [filterText, setFilterText] = useState("");
  const getRulesForTag = useRulesStore((state) => state.getRulesForTag); // Get function from store

  const filteredTags = useMemo(() => {
    const lowerFilter = filterText.toLowerCase();
    if (!lowerFilter) return allTags;
    return allTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(lowerFilter) ||
        tag.description?.toLowerCase().includes(lowerFilter),
    );
  }, [allTags, filterText]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter tags..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="pl-8 h-9"
          disabled={disabled}
        />
      </div>
      <ScrollArea className="h-48 border rounded-md p-2 bg-background/50">
        {filteredTags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {allTags.length === 0
              ? "No tags defined globally."
              : "No tags match filter."}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredTags.map((tag) => {
              const rulesInTag = getRulesForTag(tag.id); // Use the store function
              return (
                <div
                  key={tag.id}
                  className="flex items-start justify-between p-1.5 rounded hover:bg-muted"
                >
                  <div className="flex items-center space-x-2 flex-grow mr-2">
                    <Checkbox
                      id={`project-default-tag-${tag.id}`}
                      checked={selectedTagIds.has(tag.id)}
                      onCheckedChange={(checked) =>
                        onSelectionChange(tag.id, !!checked)
                      }
                      className="mt-0.5"
                      disabled={disabled}
                    />
                    <Label
                      htmlFor={`project-default-tag-${tag.id}`}
                      className="text-sm font-normal cursor-pointer space-y-0.5"
                    >
                      <span className="block font-medium">{tag.name}</span>
                      {tag.description && (
                        <span className="block text-xs text-muted-foreground">
                          {tag.description}
                        </span>
                      )}
                      {rulesInTag.length > 0 && (
                        <span className="block text-xs text-blue-500 dark:text-blue-400">
                          Includes: {rulesInTag.map((r) => r.name).join(", ")}
                        </span>
                      )}
                    </Label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
