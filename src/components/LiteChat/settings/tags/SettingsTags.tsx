// src/components/LiteChat/settings/tags/SettingsTags.tsx
// FULL FILE - No structural changes needed, just ensure TagRuleLinker is used correctly.
import React, { useState, useCallback, useMemo } from "react";
import { useRulesStore } from "@/store/rules.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { TagForm } from "./TagForm";
import { TagsList } from "./TagsList";
import { TagRuleLinker } from "./TagRuleLinker"; // Ensure this is imported
import type { DbTag, DbRule } from "@/types/litechat/rules";
import { Separator } from "@/components/ui/separator";

export const SettingsTags: React.FC = () => {
  const {
    tags,
    rules,
    tagRuleLinks,
    addTag,
    updateTag,
    deleteTag,
    linkTagToRule,
    unlinkTagFromRule,
    getRulesForTag,
    isLoading,
  } = useRulesStore(
    useShallow((state) => ({
      tags: state.tags,
      rules: state.rules,
      tagRuleLinks: state.tagRuleLinks,
      addTag: state.addTag,
      updateTag: state.updateTag,
      deleteTag: state.deleteTag,
      linkTagToRule: state.linkTagToRule,
      unlinkTagFromRule: state.unlinkTagFromRule,
      getRulesForTag: state.getRulesForTag,
      isLoading: state.isLoading,
    })),
  );

  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<DbTag | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  const handleAddNew = () => {
    setEditingTag(null);
    setShowForm(true);
  };

  const handleEdit = (tag: DbTag) => {
    setEditingTag(tag);
    setShowForm(true);
  };

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingTag(null);
    setIsSaving(false);
  }, []);

  const handleSave = useCallback(
    async (data: Omit<DbTag, "id" | "createdAt" | "updatedAt">) => {
      setIsSaving(true);
      try {
        if (editingTag) {
          await updateTag(editingTag.id, data);
        } else {
          await addTag(data);
        }
        // Keep form open if editing, close if adding
        if (!editingTag) {
          handleCancel();
        }
      } catch (error) {
        // Error handled by store
      } finally {
        setIsSaving(false);
      }
    },
    [addTag, updateTag, editingTag, handleCancel],
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      setIsDeleting((prev) => ({ ...prev, [id]: true }));
      try {
        await deleteTag(id);
        // If the deleted tag was being edited, close the form
        if (editingTag?.id === id) {
          handleCancel();
        }
      } catch (error) {
        // Error handled by store
      } finally {
        setIsDeleting((prev) => ({ ...prev, [id]: false }));
      }
    },
    [deleteTag, editingTag, handleCancel],
  );

  const handleLinkChange = useCallback(
    async (tagId: string, ruleId: string, isLinked: boolean) => {
      try {
        if (isLinked) {
          await linkTagToRule(tagId, ruleId);
        } else {
          await unlinkTagFromRule(tagId, ruleId);
        }
      } catch (error) {
        // Error handled by store
      }
    },
    [linkTagToRule, unlinkTagFromRule],
  );

  const rulesByTagId = useMemo(() => {
    const map = new Map<string, DbRule[]>();
    tags.forEach((tag) => {
      map.set(tag.id, getRulesForTag(tag.id));
    });
    return map;
  }, [tags, getRulesForTag]);

  const linkedRuleIdsForEditingTag = useMemo(() => {
    if (!editingTag) return new Set<string>();
    return new Set(
      tagRuleLinks
        .filter((link) => link.tagId === editingTag.id)
        .map((link) => link.ruleId),
    );
  }, [editingTag, tagRuleLinks]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Manage Tags
        </h3>
        <p className="text-sm text-muted-foreground">
          Create tags to group related rules. You can activate tags before
          sending a prompt to apply their associated rules.
        </p>
      </div>

      {!showForm && (
        <Button
          onClick={handleAddNew}
          variant="outline"
          className="w-full"
          disabled={isLoading}
        >
          <PlusIcon className="h-4 w-4 mr-1" /> Add New Tag
        </Button>
      )}

      {showForm && (
        // Grid layout for form and linker side-by-side on larger screens
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TagForm
            initialData={editingTag ?? undefined}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
          {/* TagRuleLinker now uses a combobox internally */}
          {editingTag && (
            <TagRuleLinker
              tag={editingTag}
              allRules={rules}
              linkedRuleIds={linkedRuleIdsForEditingTag}
              onLinkChange={handleLinkChange}
              disabled={isSaving}
            />
          )}
        </div>
      )}

      <Separator />

      <div className="pt-4">
        <h4 className="text-md font-medium mb-2">Existing Tags</h4>
        <TagsList
          tags={tags}
          rulesByTagId={rulesByTagId}
          isLoading={isLoading}
          isDeleting={isDeleting}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};
