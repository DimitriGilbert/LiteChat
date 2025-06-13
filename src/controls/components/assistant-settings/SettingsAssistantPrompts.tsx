import React, { useEffect, useState } from "react";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Save, Edit, Trash2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import type {
  PromptTemplate,
  PromptVariable,
} from "@/types/litechat/prompt-template";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToolSelectorControlComponent } from "@/controls/components/tool-selector/ToolSelectorControlComponent";
import { RulesControlDialogContent } from "@/controls/components/rules/RulesControlDialogContent";
import { useRulesStore } from "@/store/rules.store";

interface PromptTemplateFormData {
  name: string;
  description: string;
  variables: PromptVariable[];
  prompt: string;
  tags: string[];
  tools: string[];
  rules: string[];
  type: "prompt" | "task" | "agent";
  parentId?: string | null;
  followUps?: string[];
}

const promptTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  variables: z.array(
    z.object({
      name: z.string().min(1, "Variable name is required"),
      description: z.string(),
      type: z.enum(["string", "number", "boolean", "array"]),
      required: z.boolean(),
      default: z.string().optional(),
      instructions: z.string().optional(),
    })
  ),
  prompt: z.string().min(1, "Prompt content is required"),
  tags: z.array(z.string()),
  tools: z.array(z.string()),
  rules: z.array(z.string()),
  type: z.enum(["prompt", "task", "agent"]),
  parentId: z.string().nullable(),
  followUps: z.array(z.string()),
});

// Mock tool selector module for the form
const createMockToolSelectorModule = (
  selectedTools: string[],
  onToolsChange: (tools: string[]) => void
) => ({
  getEnabledTools: () => new Set(selectedTools),
  setEnabledTools: (updater: (prev: Set<string>) => Set<string>) => {
    const newSet = updater(new Set(selectedTools));
    onToolsChange(Array.from(newSet));
  },
  getSelectedItemId: () => "mock-id",
  getSelectedItemType: () => "conversation" as const,
  getGlobalDefaultMaxSteps: () => 5,
});

function PromptTemplateForm({
  template,
  onSubmit,
  onSuccess,
}: {
  template?: PromptTemplate;
  onSubmit: (data: PromptTemplateFormData) => void;
  onSuccess: () => void;
}) {
  const [newVariable, setNewVariable] = useState<PromptVariable>({
    name: "",
    description: "",
    type: "string",
    required: false,
    default: "",
    instructions: "",
  });

  const [maxSteps, setMaxSteps] = useState<number | null>(null);

  // Get rules and tags data
  const {
    rules: allRules,
    tags: allTags,
    tagRuleLinks,
    loadRulesAndTags,
  } = useRulesStore(
    useShallow((state) => ({
      rules: state.rules,
      tags: state.tags,
      tagRuleLinks: state.tagRuleLinks,
      loadRulesAndTags: state.loadRulesAndTags,
    }))
  );

  useEffect(() => {
    loadRulesAndTags();
  }, [loadRulesAndTags]);

  const form = useForm({
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      variables: template?.variables || [],
      prompt: template?.prompt || "",
      tags: template?.tags || [],
      tools: template?.tools || [],
      rules: template?.rules || [],
      type: template?.type || "prompt" as const,
      parentId: template?.parentId || null,
      followUps: template?.followUps || [],
    },
    validators: {
      onChangeAsync: promptTemplateSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
      onSuccess();
    },
  });

  // Reset newVariable state when template changes
  useEffect(() => {
    setNewVariable({
      name: "",
      description: "",
      type: "string",
      required: false,
      default: "",
      instructions: "",
    });
  }, [template?.id]);

  // Cleanup effect to ensure state is reset on unmount
  useEffect(() => {
    return () => {
      // Reset state to prevent any stale references
      setNewVariable({
        name: "",
        description: "",
        type: "string",
        required: false,
        default: "",
        instructions: "",
      });
      setMaxSteps(null);
    };
  }, []);

  const addVariable = () => {
    if (newVariable.name) {
      form.setFieldValue("variables", [
        ...form.getFieldValue("variables"),
        { ...newVariable },
      ]);
      setNewVariable({
        name: "",
        description: "",
        type: "string",
        required: false,
        default: "",
        instructions: "",
      });
    }
  };

  const removeVariable = (index: number) => {
    const variables = form.getFieldValue("variables");
    form.setFieldValue(
      "variables",
      variables.filter((_, i) => i !== index)
    );
  };

  const getRulesForTag = (tagId: string) => {
    const linkIds = tagRuleLinks
      .filter((link) => link.tagId === tagId)
      .map((link) => link.ruleId);
    return allRules.filter((rule) => linkIds.includes(rule.id));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">
          {template ? "Edit Template" : "New Template"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {template
            ? "Update your prompt template"
            : "Create a reusable prompt template with variables"}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-6"
      >
        {/* Basic Info */}
        <div className="space-y-4">
          <form.Field
            name="name"
            children={(field) => (
              <div>
                <Label htmlFor={field.name}>Template Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter template name"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {field.state.meta.errors[0]?.message || "Invalid input"}
                  </p>
                )}
              </div>
            )}
          />

          <form.Field
            name="description"
            children={(field) => (
              <div>
                <Label htmlFor={field.name}>Description</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Describe what this template does"
                  rows={3}
                />
              </div>
            )}
          />

          <form.Field
            name="prompt"
            children={(field) => (
              <div>
                <Label htmlFor={field.name}>Prompt Template</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter your prompt template using {{ variable_name }} syntax"
                  rows={6}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use double curly braces to reference variables:{" "}
                  {`{{ variable_name }}`}
                </p>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {field.state.meta.errors[0]?.message || "Invalid input"}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        {/* Variables */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Variables</Label>
            <div className="space-y-3 mt-2">
              {form.getFieldValue("variables").map((variable, index) => (
                <div key={`${variable.name}-${index}`} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{variable.name}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariable(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {variable.description}
                  </p>
                  <div className="flex gap-2 text-xs">
                    <Badge
                      variant={variable.required ? "default" : "secondary"}
                    >
                      {variable.required ? "Required" : "Optional"}
                    </Badge>
                    <Badge variant="outline">{variable.type}</Badge>
                    {variable.default && (
                      <Badge variant="outline">
                        Default: {variable.default}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Variable Form */}
              <div className="p-3 border-2 border-dashed rounded-lg space-y-3">
                <Label>Add New Variable</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newVariable.name}
                      onChange={(e) =>
                        setNewVariable((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Variable name"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      key={`new-variable-type-${template?.id || 'new'}`}
                      value={newVariable.type}
                      onValueChange={(
                        value: "string" | "number" | "boolean" | "array"
                      ) => setNewVariable((prev) => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="array">Array</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newVariable.description}
                    onChange={(e) =>
                      setNewVariable((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Describe this variable"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Default Value</Label>
                    <Input
                      value={newVariable.default}
                      onChange={(e) =>
                        setNewVariable((prev) => ({
                          ...prev,
                          default: e.target.value,
                        }))
                      }
                      placeholder="Default value (optional)"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      checked={newVariable.required}
                      onCheckedChange={(checked) =>
                        setNewVariable((prev) => ({
                          ...prev,
                          required: !!checked,
                        }))
                      }
                    />
                    <Label>Required</Label>
                  </div>
                </div>
                <Button type="button" onClick={addVariable} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Auto Tools */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Auto-select Tools</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose tools that will be automatically enabled when this template
              is applied.
            </p>
            <ToolSelectorControlComponent
              module={
                createMockToolSelectorModule(
                  form.getFieldValue("tools"),
                  (tools) => form.setFieldValue("tools", tools)
                ) as any
              }
              popoverMaxSteps={maxSteps}
              setPopoverMaxSteps={setMaxSteps}
              className="p-0 max-w-none"
            />
          </div>
        </div>

        {/* Auto Rules & Tags */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">
              Auto-select Rules & Tags
            </Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose rules and tags that will be automatically enabled when this
              template is applied.
            </p>
            <RulesControlDialogContent
              activeTagIds={new Set(form.getFieldValue("tags"))}
              activeRuleIds={new Set(form.getFieldValue("rules"))}
              onToggleTag={(tagId, isActive) => {
                const currentTags = form.getFieldValue("tags");
                if (isActive) {
                  form.setFieldValue("tags", [...currentTags, tagId]);
                } else {
                  form.setFieldValue(
                    "tags",
                    currentTags.filter((id) => id !== tagId)
                  );
                }
              }}
              onToggleRule={(ruleId, isActive) => {
                const currentRules = form.getFieldValue("rules");
                if (isActive) {
                  form.setFieldValue("rules", [...currentRules, ruleId]);
                } else {
                  form.setFieldValue(
                    "rules",
                    currentRules.filter((id) => id !== ruleId)
                  );
                }
              }}
              allRules={allRules}
              allTags={allTags}
              getRulesForTag={getRulesForTag}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button type="submit" className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {template ? "Update Template" : "Create Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PromptTemplateList({
  templates,
  onEdit,
  onDelete,
}: {
  templates: PromptTemplate[];
  onEdit: (template: PromptTemplate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Prompt Templates</h3>
        <p className="text-sm text-muted-foreground">
          Manage your reusable prompt templates with dynamic variables
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h4 className="font-medium text-muted-foreground">
            No Templates Yet
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Use the "New Template" tab to create your first template
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Tools</TableHead>
              <TableHead>Rules/Tags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {template.description}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{template.variables.length}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {template.tools?.length || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant="secondary">
                      {template.tags?.length || 0} tags
                    </Badge>
                    <Badge variant="secondary">
                      {template.rules?.length || 0} rules
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export const SettingsAssistantPrompts: React.FC = () => {
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

  const handleCreateTemplate = async (data: PromptTemplateFormData) => {
    await addPromptTemplate({
      ...data,
      type: "prompt", // Always prompt type for this interface
      isPublic: false, // Always private for now
    });
  };

  const handleUpdateTemplate = async (data: PromptTemplateFormData) => {
    if (!editingTemplate) return;
    await updatePromptTemplate(editingTemplate.id, data);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
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
      label: "Templates",
      content: (
        <PromptTemplateList
          templates={promptTypeTemplates}
          onEdit={handleEdit}
          onDelete={handleDeleteTemplate}
        />
      ),
    },
    {
      value: "new",
      label: "New Template",
      content: (
        <PromptTemplateForm
          key="new-template-form"
          onSubmit={handleCreateTemplate}
          onSuccess={handleFormSuccess}
        />
      ),
    },
  ];

  // Add edit tab dynamically when editing
  if (editingTemplate) {
    tabs.push({
      value: "edit",
      label: `Edit: ${editingTemplate.name}`,
      content: (
        <PromptTemplateForm
          key={`edit-template-form-${editingTemplate.id}`}
          template={editingTemplate}
          onSubmit={handleUpdateTemplate}
          onSuccess={handleFormSuccess}
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
