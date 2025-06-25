// src/controls/components/rules/RulesControlDialogContent.tsx
// FULL FILE
import React, { useState, useMemo, useCallback } from "react";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchIcon, Settings } from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent } from "@/types/litechat/events/ui.events";
import type { DbRule, DbTag } from "@/types/litechat/rules"; // Import types
import { useSettingsStore } from "@/store/settings.store";

interface RulesControlDialogContentProps {
  activeTagIds: Set<string>;
  activeRuleIds: Set<string>;
  onToggleTag: (tagId: string, isActive: boolean) => void;
  onToggleRule: (ruleId: string, isActive: boolean) => void;
  allRules: DbRule[]; // Add prop
  allTags: DbTag[]; // Add prop
  getRulesForTag: (tagId: string) => DbRule[]; // Add prop
  onAutoSelectRules?: () => void; // Add auto-select callback
}

export const RulesControlDialogContent: React.FC<
  RulesControlDialogContentProps
> = ({
  activeTagIds,
  activeRuleIds,
  onToggleTag,
  onToggleRule,
  allRules, // Destructure
  allTags, // Destructure
  getRulesForTag, // Destructure
  onAutoSelectRules, // Destructure
}) => {
  const [tagFilter, setTagFilter] = useState("");
  const [ruleFilter, setRuleFilter] = useState("");
  const autoRuleSelectionEnabled = useSettingsStore((s) => s.autoRuleSelectionEnabled);

  const filteredTags = useMemo(() => {
    const lowerFilter = tagFilter.toLowerCase();
    if (!lowerFilter) return allTags;
    return allTags.filter(
      (tag) =>
        tag.name.toLowerCase().includes(lowerFilter) ||
        tag.description?.toLowerCase().includes(lowerFilter)
    );
  }, [allTags, tagFilter]);

  const filteredRules = useMemo(() => {
    const lowerFilter = ruleFilter.toLowerCase();
    if (!lowerFilter) return allRules;
    return allRules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerFilter) ||
        rule.content.toLowerCase().includes(lowerFilter) ||
        rule.type.toLowerCase().includes(lowerFilter)
    );
  }, [allRules, ruleFilter]);

  const handleTagToggle = useCallback(
    (tagId: string, checked: boolean) => {
      onToggleTag(tagId, checked);
    },
    [onToggleTag]
  );

  const handleRuleToggle = useCallback(
    (ruleId: string, checked: boolean) => {
      onToggleRule(ruleId, checked);
    },
    [onToggleRule]
  );

  const handleOpenRulesSettings = () => {
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "settingsModal",
      initialTab: "rules-tags",
    });
  };

  const renderTagList = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter tags..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenRulesSettings}
          className="h-9 px-3"
          title="Open Rules Settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          Manage
        </Button>
      </div>
      <div className="border rounded-md p-2 bg-background/50">
        {filteredTags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {allTags.length === 0
              ? "No tags defined."
              : "No tags match filter."}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredTags.map((tag) => {
              const rulesInTag = getRulesForTag(tag.id);
              return (
                <div
                  key={tag.id}
                  className="flex items-start justify-between p-1.5 rounded hover:bg-muted"
                >
                  <div className="flex items-center space-x-2 flex-grow mr-2">
                    <Checkbox
                      id={`tag-activate-${tag.id}`}
                      checked={activeTagIds.has(tag.id)}
                      onCheckedChange={(checked) =>
                        handleTagToggle(tag.id, !!checked)
                      }
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`tag-activate-${tag.id}`}
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
      </div>
    </div>
  );

  const renderRuleList = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter rules..."
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        {onAutoSelectRules && autoRuleSelectionEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAutoSelectRules}
            className="h-9 px-3"
            title="Auto-select rules based on prompt context"
          >
            Auto-Select
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenRulesSettings}
          className="h-9 px-3"
          title="Open Rules Settings"
        >
          <Settings className="h-4 w-4 mr-1" />
          Manage
        </Button>
      </div>
      <div className="border rounded-md p-2 bg-background/50">
        {filteredRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {allRules.length === 0
              ? "No rules defined."
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
                    id={`rule-activate-${rule.id}`}
                    checked={activeRuleIds.has(rule.id)}
                    onCheckedChange={(checked) =>
                      handleRuleToggle(rule.id, !!checked)
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`rule-activate-${rule.id}`}
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
      </div>
    </div>
  );

  const tabs: TabDefinition[] = [
    { value: "rules", label: "Activate Rules", content: renderRuleList() },
    { value: "tags", label: "Activate Tags", content: renderTagList() },
  ];

  return (
    <div className="p-0 max-w-lg">
      <TabbedLayout tabs={tabs} defaultValue="rules" scrollable={false} />
    </div>
  );
};
