// src/components/LiteChat/settings/tags/TagsList.tsx
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
import type { DbTag, DbRule } from "@/types/litechat/rules";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionTooltipButton } from "../../common/ActionTooltipButton";

interface TagsListProps {
  tags: DbTag[];
  rulesByTagId: Map<string, DbRule[]>;
  isLoading: boolean;
  isDeleting: Record<string, boolean>;
  onEdit: (tag: DbTag) => void;
  onDelete: (id: string, name: string) => Promise<void>;
}

export const TagsList: React.FC<TagsListProps> = ({
  tags,
  rulesByTagId,
  isLoading,
  isDeleting,
  onEdit,
  onDelete,
}) => {
  const handleDeleteClick = (tag: DbTag) => {
    if (
      window.confirm(
        `Are you sure you want to delete the tag "${tag.name}"? This will remove it from all rules.`,
      )
    ) {
      onDelete(tag.id, tag.name);
    }
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Linked Rules</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <>
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-10 w-full" />
                </TableCell>
              </TableRow>
            </>
          ) : tags.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                No tags defined yet.
              </TableCell>
            </TableRow>
          ) : (
            tags.map((tag) => {
              const isTagDeleting = isDeleting[tag.id];
              const linkedRules = rulesByTagId.get(tag.id) || [];
              return (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{tag.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                    {tag.description || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {linkedRules.length > 0
                      ? linkedRules.map((r) => r.name).join(", ")
                      : "None"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <ActionTooltipButton
                      tooltipText="Edit Tag & Rules"
                      onClick={() => onEdit(tag)}
                      disabled={isTagDeleting}
                      icon={<Edit2Icon />}
                      className="h-8 w-8"
                      aria-label={`Edit tag ${tag.name}`} // Added aria-label
                    />
                    <ActionTooltipButton
                      tooltipText="Delete Tag"
                      onClick={() => handleDeleteClick(tag)}
                      disabled={isTagDeleting}
                      icon={
                        isTagDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2Icon />
                        )
                      }
                      className="text-destructive hover:text-destructive/80 h-8 w-8"
                      aria-label={`Delete tag ${tag.name}`} // Added aria-label
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
