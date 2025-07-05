import React, { useEffect, useState } from "react";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";
import type {
  PromptTemplate,
} from "@/types/litechat/prompt-template";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { TemplateFormBase, BaseTemplateFormData } from "./common/TemplateFormBase";
import { TemplateList } from "./common/TemplateList";





export const SettingsAssistantPrompts: React.FC = () => {
  const { t } = useTranslation('assistantSettings');
  const [activeTab, setActiveTab] = useState("templates");
  const [editingTemplate, setEditingTemplate] = useState<
    PromptTemplate | undefined
  >();

  const {
    loadPromptTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    getTemplatesByType,
  } = usePromptTemplateStore(
    useShallow((state) => ({
      loadPromptTemplates: state.loadPromptTemplates,
      addPromptTemplate: state.addPromptTemplate,
      updatePromptTemplate: state.updatePromptTemplate,
      deletePromptTemplate: state.deletePromptTemplate,
      getTemplatesByType: state.getTemplatesByType,
    }))
  );

  // Filter to only show prompt type templates
  const promptTypeTemplates = getTemplatesByType("prompt");

  useEffect(() => {
    loadPromptTemplates();
  }, [loadPromptTemplates]);

  const handleCreateTemplate = async (data: BaseTemplateFormData) => {
    await addPromptTemplate({
      ...data,
      type: "prompt", // Always prompt type for this interface
      isPublic: false, // Always private for now
      isShortcut: data.isShortcut || false,
    });
  };

  const handleUpdateTemplate = async (data: BaseTemplateFormData) => {
    if (!editingTemplate) return;
    await updatePromptTemplate(editingTemplate.id, {
      ...data,
      isShortcut: data.isShortcut || false,
    });
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm(t('assistantPrompts.deleteConfirmation'))) {
      await deletePromptTemplate(id);
    }
  };

  const handleEdit = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setActiveTab("edit");
  };

  const handleFormSuccess = () => {
    setActiveTab("templates");
    setEditingTemplate(undefined);
  };

  const tabs: TabDefinition[] = [
    {
      value: "templates",
      label: t('assistantPrompts.templates'),
      content: (
        <TemplateList
          templates={promptTypeTemplates}
          onEdit={handleEdit}
          onDelete={handleDeleteTemplate}
          type="prompt"
        />
      ),
    },
    {
      value: "new",
      label: t('assistantPrompts.newTemplate'),
      content: (
        <TemplateFormBase
          key="new-template-form"
          onSubmit={handleCreateTemplate}
          onSuccess={handleFormSuccess}
          type="prompt"
          showFollowUps={true}
          followUpOptions={promptTypeTemplates}
        />
      ),
    },
  ];

  // Add edit tab dynamically when editing
  if (editingTemplate) {
    tabs.push({
      value: "edit",
      label: t('assistantPrompts.editTemplate', { name: editingTemplate.name }),
      content: (
        <TemplateFormBase
          key={`edit-template-form-${editingTemplate.id}`}
          template={editingTemplate}
          onSubmit={handleUpdateTemplate}
          onSuccess={handleFormSuccess}
          type="prompt"
          showFollowUps={true}
          followUpOptions={promptTypeTemplates}
        />
      ),
    });
  }

  return (
    <TabbedLayout
      tabs={tabs}
      initialValue={activeTab}
      onValueChange={setActiveTab}
      defaultValue="templates"
      contentContainerClassName="pb-2 sm:pb-6 pr-1 sm:pr-2 -mr-1 sm:-mr-2"
      scrollable={false}
    />
  );
};
