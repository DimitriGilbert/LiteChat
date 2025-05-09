// src/components/LiteChat/settings/rules/SettingsRules.tsx
// FULL FILE
import React, { useState, useCallback } from "react";
import { useRulesStore } from "@/store/rules.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { RuleForm } from "./RuleForm";
import { RulesList } from "./RulesList";
import type { DbRule } from "@/types/litechat/rules";

export const SettingsRules: React.FC = () => {
  const { rules, addRule, updateRule, deleteRule, isLoading } = useRulesStore(
    useShallow((state) => ({
      rules: state.rules,
      addRule: state.addRule,
      updateRule: state.updateRule,
      deleteRule: state.deleteRule,
      isLoading: state.isLoading,
    })),
  );

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<DbRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

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
          await updateRule(editingRule.id, data);
        } else {
          await addRule(data);
        }
        handleCancel();
      } catch (error) {
        // Error handled by store
      } finally {
        setIsSaving(false);
      }
    },
    [addRule, updateRule, editingRule, handleCancel],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setIsDeleting((prev) => ({ ...prev, [id]: true }));
      try {
        await deleteRule(id);
        // If the deleted rule was being edited, close the form
        if (editingRule?.id === id) {
          handleCancel();
        }
      } catch (error) {
        // Error handled by store
      } finally {
        setIsDeleting((prev) => ({ ...prev, [id]: false }));
      }
    },
    [deleteRule, editingRule, handleCancel],
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
          isSaving={isSaving}
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
