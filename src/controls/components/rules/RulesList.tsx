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
import type { DbRule } from "@/types/litechat/rules";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

interface RulesListProps {
  rules: DbRule[];
  isLoading: boolean;
  isDeleting: Record<string, boolean>;
  onEdit: (rule: DbRule) => void;
  onDelete: (id: string, name: string) => Promise<void>;
}

export const RulesList: React.FC<RulesListProps> = ({
  rules,
  isLoading,
  isDeleting,
  onEdit,
  onDelete,
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
                  <TableCell className="capitalize">{rule.type}</TableCell>
                  <TableCell>
                    {rule.alwaysOn && (
                      <Badge variant="secondary" className="text-xs">
                        Always On
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                    {rule.content}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <ActionTooltipButton
                      tooltipText="Edit Rule"
                      onClick={() => onEdit(rule)}
                      disabled={isRuleDeleting}
                      icon={<Edit2Icon />}
                      className="h-8 w-8"
                      aria-label={`Edit rule ${rule.name}`} // Added aria-label
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
                      aria-label={`Delete rule ${rule.name}`} // Added aria-label
                    />
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
