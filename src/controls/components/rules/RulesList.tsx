// src/components/LiteChat/settings/rules/RulesList.tsx
// FULL FILE
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit2Icon, Trash2Icon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { DbRule } from "@/types/litechat/rules";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

interface RulesListProps {
  rules: DbRule[];
  isLoading: boolean;
  isDeleting: Record<string, boolean>;
  onEdit: (rule: DbRule) => void;
  onDelete: (id: string, name: string) => Promise<void>;
  onToggleAlwaysOn?: (ruleId: string, alwaysOn: boolean) => void;
}

export const RulesList: React.FC<RulesListProps> = ({
  rules,
  isLoading,
  isDeleting,
  onEdit,
  onDelete,
  onToggleAlwaysOn,
}) => {
  const handleDeleteClick = (rule: DbRule) => {
    if (
      window.confirm(
        `Are you sure you want to delete the rule "${rule.name}"? This will also remove it from any tags.`
      )
    ) {
      onDelete(rule.id, rule.name);
    }
  };

  const handleAlwaysOnToggle = (rule: DbRule, checked: boolean) => {
    onToggleAlwaysOn?.(rule.id, checked);
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Always On</TableHead>
            <TableHead>Content Preview</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <>
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            </>
          ) : rules.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-24 text-center text-muted-foreground"
              >
                No rules defined yet.
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule) => {
              const isRuleDeleting = isDeleting[rule.id];
              return (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="capitalize">
                    {rule.type}
                    {rule.type === "control" && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Control
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={rule.alwaysOn || false}
                        onCheckedChange={(checked) => handleAlwaysOnToggle(rule, checked)}
                        disabled={isRuleDeleting}
                        aria-label={`Toggle always on for ${rule.name}`}
                      />
                      {rule.alwaysOn && (
                        <Badge variant="secondary" className="text-xs">
                          On
                        </Badge>
                      )}
                      {rule.type === "control" && !rule.alwaysOn && (
                        <Badge variant="outline" className="text-xs">
                          Control
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                    {rule.content}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {rule.type === "control" ? (
                      <Badge variant="secondary" className="text-xs">
                        Module-defined
                      </Badge>
                    ) : (
                      <>
                        <ActionTooltipButton
                          tooltipText="Edit Rule"
                          onClick={() => onEdit(rule)}
                          disabled={isRuleDeleting}
                          icon={<Edit2Icon />}
                          className="h-8 w-8"
                          aria-label={`Edit rule ${rule.name}`}
                        />
                        <ActionTooltipButton
                          tooltipText="Delete Rule"
                          onClick={() => handleDeleteClick(rule)}
                          disabled={isRuleDeleting}
                          icon={
                            isRuleDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2Icon />
                            )
                          }
                          className="text-destructive hover:text-destructive/80 h-8 w-8"
                          aria-label={`Delete rule ${rule.name}`}
                        />
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
