// src/controls/components/project-settings/ProjectSettingsRules.tsx
// FULL FILE
import React, { useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { ProjectDefaultRuleSelector } from "./ProjectDefaultRuleSelector";
import type { DbRule } from "@/types/litechat/rules"; // Import DbRule

interface ProjectSettingsRulesProps {
  defaultRuleIds: string[] | null;
  setDefaultRuleIds: (ids: string[] | null) => void;
  isSaving: boolean;
  allRules: DbRule[]; // Add prop for allRules
}

export const ProjectSettingsRules: React.FC<ProjectSettingsRulesProps> = ({
  defaultRuleIds,
  setDefaultRuleIds,
  isSaving,
  allRules, // Destructure allRules
}) => {
  const selectedRuleIdsSet = useMemo(
    () => new Set(defaultRuleIds ?? []),
    [defaultRuleIds]
  );

  const handleSelectionChange = useCallback(
    (ruleId: string, selected: boolean) => {
      const nextSet = new Set(selectedRuleIdsSet);
      if (selected) {
        nextSet.add(ruleId);
      } else {
        nextSet.delete(ruleId);
      }
      const nextArray = Array.from(nextSet);
      setDefaultRuleIds(nextArray.length > 0 ? nextArray : null);
    },
    [selectedRuleIdsSet, setDefaultRuleIds]
  );

  return (
    <div className="space-y-4">
      <Label>Default Rules for this Project</Label>
      <p className="text-xs text-muted-foreground">
        Select rules that will be automatically applied to new conversations
        within this project. These can be overridden per-conversation or
        per-turn.
      </p>
      <ProjectDefaultRuleSelector
        allRules={allRules} // Pass down allRules
        selectedRuleIds={selectedRuleIdsSet}
        onSelectionChange={handleSelectionChange}
        disabled={isSaving}
      />
    </div>
  );
};
