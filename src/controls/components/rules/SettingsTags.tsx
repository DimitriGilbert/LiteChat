// src/controls/components/rules/SettingsTags.tsx
// FULL FILE
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { TagForm } from "./TagForm";
import { TagsList } from "./TagsList";
import { TagRuleLinker } from "./TagRuleLinker";
import type { DbTag, DbRule } from "@/types/litechat/rules";
import { Separator } from "@/components/ui/separator";
import type { RulesControlModule } from "@/controls/modules/RulesControlModule";

interface SettingsTagsProps {
  module: RulesControlModule;
}

export const SettingsTags: React.FC<SettingsTagsProps> = ({ module }) => {
  const [, setLastUpdated] = useState(Date.now());

  const tags = module.getAllTags();
  const rules = module.getAllRules();
  const tagRuleLinks = module.getTagRuleLinks();
  const getRulesForTag = module.getRulesForTag;
  const isLoading = module.getIsLoadingRules();

  const [showForm, setShowForm] = useState(false);
  const [editingTag, setEditingTag] = useState<DbTag | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    module.setNotifySettingsCallback(() => setLastUpdated(Date.now()));

    return () => {
      module.setNotifySettingsCallback(null);
    };
  }, [module]);

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
          module.updateTag(editingTag.id, data);
        } else {
          module.addTag(data);
        }
        if (!editingTag) {
          handleCancel();
        }
      } catch (error) {
        // Error handled by store/emitter
      } finally {
        setIsSaving(false);
      }
    },
    [module, editingTag, handleCancel]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // name prop added for consistency
      setIsDeleting((prev) => ({ ...prev, [id]: true }));
      try {
        module.deleteTag(id);
        if (editingTag?.id === id) {
          handleCancel();
        }
      } catch (error) {
        // Error handled by store/emitter
      } finally {
        setIsDeleting((prev) => ({ ...prev, [id]: false }));
      }
    },
    [module, editingTag, handleCancel]
  );

  const handleLinkChange = useCallback(
    async (tagId: string, ruleId: string, isLinked: boolean) => {
      try {
        if (isLinked) {
          module.linkTagToRule(tagId, ruleId);
        } else {
          module.unlinkTagFromRule(tagId, ruleId);
        }
      } catch (error) {
        // Error handled by store/emitter
      }
    },
    [module]
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
        .map((link) => link.ruleId)
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TagForm
            initialData={editingTag ?? undefined}
            isParentSaving={isSaving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
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
