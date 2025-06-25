// src/controls/components/rules/SettingsRules.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { RuleForm } from "./RuleForm";
import { RulesList } from "./RulesList";
import type { DbRule } from "@/types/litechat/rules";
import type { RulesControlModule } from "@/controls/modules/RulesControlModule";
import { emitter } from "@/lib/litechat/event-emitter";
import { controlRegistryEvent } from "@/types/litechat/events/control.registry.events";
import { rulesEvent } from "@/types/litechat/events/rules.events";
import { SettingsAutoRules } from "./SettingsAutoRules";

interface SettingsRulesProps {
  module: RulesControlModule;
}

export const SettingsRules: React.FC<SettingsRulesProps> = ({ module }) => {
  const [, setLastUpdated] = useState(Date.now());

  // Get ALL rules through module (includes both DB and control rules)
  // This avoids direct Zustand store access and uses the module's abstraction
  const allRules = module.getAllRules();
  const isLoading = module.getIsLoadingRules();

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<DbRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Listen to both rules and control rules events for reactive updates (event-driven)
    const handleRulesChanged = () => setLastUpdated(Date.now());
    const handleControlRulesChanged = () => setLastUpdated(Date.now());
    
    emitter.on(rulesEvent.dataLoaded, handleRulesChanged);
    emitter.on(controlRegistryEvent.controlRulesChanged, handleControlRulesChanged);

    // Keep the module callback for backward compatibility with existing trigger component
    module.setNotifySettingsCallback(() => setLastUpdated(Date.now()));

    return () => {
      emitter.off(rulesEvent.dataLoaded, handleRulesChanged);
      emitter.off(controlRegistryEvent.controlRulesChanged, handleControlRulesChanged);
      module.setNotifySettingsCallback(null);
    };
  }, [module]);

  const handleAddNew = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEdit = (rule: DbRule) => {
    // Prevent editing control rules
    if (rule.type === "control") {
      console.warn(`Cannot edit control rule "${rule.name}". Control rules are managed automatically by modules.`);
      return;
    }
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

  const handleRuleToggle = useCallback(
    (ruleId: string, alwaysOn: boolean) => {
      // Use the module's method which handles both control and DB rules appropriately
      // This avoids direct store access and maintains the event-driven pattern
      module.updateRule(ruleId, { alwaysOn });
    },
    [module]
  );

  const handleControlRuleToggle = useCallback(
    (ruleId: string, isOn: boolean) => {
      // Use module's updateRule method which handles both settings update and notifications
      module.updateRule(ruleId, { alwaysOn: isOn });
    },
    [module]
  );

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {editingRule ? "Edit Rule" : "Add New Rule"}
          </h3>
          <Button variant="outline" onClick={handleCancel}>
            Back to List
          </Button>
        </div>
        <RuleForm
          initialData={editingRule ?? undefined}
          onSave={handleSave}
          onCancel={handleCancel}
          isSavingExt={isSaving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Rules</h3>
        <Button onClick={handleAddNew} size="sm">
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>
      <RulesList
        rules={allRules}
        isLoading={isLoading}
        isDeleting={isDeleting}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleAlwaysOn={(ruleId, alwaysOn) => {
          const rule = allRules.find(r => r.id === ruleId);
          if (rule?.type === 'control') {
            handleControlRuleToggle(ruleId, alwaysOn);
          } else {
            handleRuleToggle(ruleId, alwaysOn);
          }
        }}
      />
      <SettingsAutoRules />
    </div>
  );
};
