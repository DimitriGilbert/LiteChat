// src/controls/components/rules/SettingsRules.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { RuleForm } from "./RuleForm";
import { RulesList } from "./RulesList";
import type { DbRule } from "@/types/litechat/rules";
import type { RulesControlModule } from "@/controls/modules/RulesControlModule";

interface SettingsRulesProps {
  module: RulesControlModule;
}

export const SettingsRules: React.FC<SettingsRulesProps> = ({ module }) => {
  const [, setLastUpdated] = useState(Date.now());

  const rules = module.getAllRules();
  const isLoading = module.getIsLoadingRules();

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<DbRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    module.setNotifySettingsCallback(() => setLastUpdated(Date.now()));

    return () => {
      module.setNotifySettingsCallback(null);
    };
  }, [module]);

  const handleAddNew = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEdit = (rule: DbRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingRule(null);
    setIsSaving(false);
  }, []);

  const handleSave = useCallback(
    async (data: Omit<DbRule, "id" | "createdAt" | "updatedAt">) => {
      setIsSaving(true);
      try {
        if (editingRule) {
          module.updateRule(editingRule.id, data);
        } else {
          module.addRule(data);
        }
        handleCancel();
      } catch (error) {
        // Error handled by store/emitter
      } finally {
        setIsSaving(false);
      }
    },
    [module, editingRule, handleCancel]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // name prop added for consistency, though not used in this specific confirm
      setIsDeleting((prev) => ({ ...prev, [id]: true }));
      try {
        module.deleteRule(id);
        if (editingRule?.id === id) {
          handleCancel();
        }
      } catch (error) {
        // Error handled by store/emitter
      } finally {
        setIsDeleting((prev) => ({ ...prev, [id]: false }));
      }
    },
    [module, editingRule, handleCancel]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Manage Rules
        </h3>
        <p className="text-sm text-muted-foreground">
          Create reusable text snippets (rules) that can be automatically
          injected into prompts based on assigned tags. Rules can modify the
          system prompt, or be added before/after the user's input.
        </p>
      </div>

      {!showForm && (
        <Button
          onClick={handleAddNew}
          variant="outline"
          className="w-full"
          disabled={isLoading}
        >
          <PlusIcon className="h-4 w-4 mr-1" /> Add New Rule
        </Button>
      )}

      {showForm && (
        <RuleForm
          initialData={editingRule ?? undefined}
          isSavingExt={isSaving}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      <div className="pt-4">
        <h4 className="text-md font-medium mb-2">Existing Rules</h4>
        <RulesList
          rules={rules}
          isLoading={isLoading}
          isDeleting={isDeleting}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};
