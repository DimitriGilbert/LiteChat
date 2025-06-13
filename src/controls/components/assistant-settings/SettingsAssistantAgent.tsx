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

interface AgentFormData {
  name: string;
  description: string;
  variables: PromptVariable[];
  prompt: string;
  tags: string[];
  tools: string[];
  rules: string[];
  followUps: string[];
}

interface TaskFormData {
  name: string;
  description: string;
  variables: PromptVariable[];
  prompt: string;
  tags: string[];
  tools: string[];
  rules: string[];
  followUps: string[];
}

const agentSchema = z.object({
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
  followUps: z.array(z.string()),
});

const taskSchema = z.object({
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

function AgentForm({
  agent,
  onSubmit,
  onSuccess,
}: {
  agent?: PromptTemplate;
  onSubmit: (data: AgentFormData) => void;
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

  const { getTemplatesByType } = usePromptTemplateStore(
    useShallow((state) => ({
      getTemplatesByType: state.getTemplatesByType,
    }))
  );

  // Get only prompt type templates for follow-ups
  const promptTemplates = getTemplatesByType("prompt");

  useEffect(() => {
    loadRulesAndTags();
  }, [loadRulesAndTags]);

  const form = useForm({
    defaultValues: {
      name: agent?.name || "",
      description: agent?.description || "",
      variables: agent?.variables || [],
      prompt: agent?.prompt || "",
      tags: agent?.tags || [],
      tools: agent?.tools || [],
      rules: agent?.rules || [],
      followUps: agent?.followUps || [],
    },
    validators: {
      onChangeAsync: agentSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
      onSuccess();
    },
  });

  // Reset newVariable state when agent changes
  useEffect(() => {
    setNewVariable({
      name: "",
      description: "",
      type: "string",
      required: false,
      default: "",
      instructions: "",
    });
  }, [agent?.id]);

  // Cleanup effect to ensure state is reset on unmount
  useEffect(() => {
    return () => {
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
          {agent ? "Edit Agent" : "New Agent"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {agent
            ? "Update your AI agent"
            : "Create a new AI agent with tasks"}
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
                <Label htmlFor={field.name}>Agent Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter agent name"
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
                  placeholder="Describe what this agent does"
                  rows={3}
                />
              </div>
            )}
          />

          <form.Field
            name="prompt"
            children={(field) => (
              <div>
                <Label htmlFor={field.name}>Agent Prompt</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter your agent prompt using {{ variable_name }} syntax"
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
                      key={`new-variable-type-${agent?.id || 'new'}`}
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

        {/* Follow-ups */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Follow-up Prompts</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Select prompts that can be used as follow-ups for this agent.
            </p>
            <form.Field
              name="followUps"
              children={(field) => (
                <div className="space-y-2">
                  {promptTemplates.map((template) => (
                    <div key={template.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={field.state.value.includes(template.id)}
                        onCheckedChange={(checked) => {
                          const currentFollowUps = field.state.value;
                          if (checked) {
                            field.handleChange([...currentFollowUps, template.id]);
                          } else {
                            field.handleChange(
                              currentFollowUps.filter((id) => id !== template.id)
                            );
                          }
                        }}
                      />
                      <Label className="text-sm font-normal">
                        {template.name}
                      </Label>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">
                          - {template.description}
                        </span>
                      )}
                    </div>
                  ))}
                  {promptTemplates.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No prompt templates available. Create some prompts first.
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        {/* Auto Tools */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Auto-select Tools</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose tools that will be automatically enabled when this agent
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
              agent is applied.
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
            {agent ? "Update Agent" : "Create Agent"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TaskForm({
  task,
  agentId,
  onSubmit,
  onSuccess,
}: {
  task?: PromptTemplate;
  agentId: string;
  onSubmit: (data: TaskFormData) => void;
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

  const { getTasksForAgent } = usePromptTemplateStore(
    useShallow((state) => ({
      getTasksForAgent: state.getTasksForAgent,
    }))
  );

  // Get other tasks for the same agent for follow-ups
  const siblingTasks = getTasksForAgent(agentId).filter(t => t.id !== task?.id);

  useEffect(() => {
    loadRulesAndTags();
  }, [loadRulesAndTags]);

  const form = useForm({
    defaultValues: {
      name: task?.name || "",
      description: task?.description || "",
      variables: task?.variables || [],
      prompt: task?.prompt || "",
      tags: task?.tags || [],
      tools: task?.tools || [],
      rules: task?.rules || [],
      followUps: task?.followUps || [],
    },
    validators: {
      onChangeAsync: taskSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
      onSuccess();
    },
  });

  // Reset newVariable state when task changes
  useEffect(() => {
    setNewVariable({
      name: "",
      description: "",
      type: "string",
      required: false,
      default: "",
      instructions: "",
    });
  }, [task?.id]);

  // Cleanup effect to ensure state is reset on unmount
  useEffect(() => {
    return () => {
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
          {task ? "Edit Task" : "New Task"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {task
            ? "Update this agent task"
            : "Create a new task for this agent"}
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
                <Label htmlFor={field.name}>Task Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter task name"
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
                  placeholder="Describe what this task does"
                  rows={3}
                />
              </div>
            )}
          />

          <form.Field
            name="prompt"
            children={(field) => (
              <div>
                <Label htmlFor={field.name}>Task Prompt</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Enter your task prompt using {{ variable_name }} syntax"
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
                      key={`new-variable-type-${task?.id || 'new'}`}
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

        {/* Follow-ups (only other tasks with same parentId) */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Follow-up Tasks</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Select other tasks from this agent that can be used as follow-ups.
            </p>
            <form.Field
              name="followUps"
              children={(field) => (
                <div className="space-y-2">
                  {siblingTasks.map((siblingTask) => (
                    <div key={siblingTask.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={field.state.value.includes(siblingTask.id)}
                        onCheckedChange={(checked) => {
                          const currentFollowUps = field.state.value;
                          if (checked) {
                            field.handleChange([...currentFollowUps, siblingTask.id]);
                          } else {
                            field.handleChange(
                              currentFollowUps.filter((id) => id !== siblingTask.id)
                            );
                          }
                        }}
                      />
                      <Label className="text-sm font-normal">
                        {siblingTask.name}
                      </Label>
                      {siblingTask.description && (
                        <span className="text-xs text-muted-foreground">
                          - {siblingTask.description}
                        </span>
                      )}
                    </div>
                  ))}
                  {siblingTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No other tasks available for this agent.
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        </div>

        {/* Auto Tools */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Auto-select Tools</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose tools that will be automatically enabled when this task
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
              task is applied.
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
            {task ? "Update Task" : "Create Task"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AgentList({
  agents,
  onEdit,
  onDelete,
  onManageTasks,
}: {
  agents: PromptTemplate[];
  onEdit: (agent: PromptTemplate) => void;
  onDelete: (id: string) => void;
  onManageTasks: (agent: PromptTemplate) => void;
}) {
  const { getTasksForAgent } = usePromptTemplateStore(
    useShallow((state) => ({
      getTasksForAgent: state.getTasksForAgent,
    }))
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">AI Agents</h3>
        <p className="text-sm text-muted-foreground">
          Manage your AI agents and their associated tasks
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h4 className="font-medium text-muted-foreground">
            No Agents Yet
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Use the "New Agent" tab to create your first agent
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Tools</TableHead>
              <TableHead>Rules/Tags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const tasks = getTasksForAgent(agent.id);
              return (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {agent.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{agent.variables.length}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tasks.length}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {agent.tools?.length || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge variant="secondary">
                        {agent.tags?.length || 0} tags
                      </Badge>
                      <Badge variant="secondary">
                        {agent.rules?.length || 0} rules
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onManageTasks(agent)}
                        title="Manage Tasks"
                      >
                        <Edit className="h-4 w-4" />
                        Tasks
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(agent)}
                        title="Edit Agent"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(agent.id)}
                        title="Delete Agent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function TaskList({
  agent,
  tasks,
  onEdit,
  onDelete,
  onNewTask,
}: {
  agent: PromptTemplate;
  tasks: PromptTemplate[];
  onEdit: (task: PromptTemplate) => void;
  onDelete: (id: string) => void;
  onNewTask: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Tasks for {agent.name}</h3>
          <p className="text-sm text-muted-foreground">
            Manage tasks for this agent
          </p>
        </div>
        <Button onClick={onNewTask}>
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h4 className="font-medium text-muted-foreground">
            No Tasks Yet
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Create tasks to define what this agent can do
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead>Follow-ups</TableHead>
              <TableHead>Tools</TableHead>
              <TableHead>Rules/Tags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell className="max-w-xs truncate">
                  {task.description}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{task.variables.length}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {task.followUps?.length || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {task.tools?.length || 0}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant="secondary">
                      {task.tags?.length || 0} tags
                    </Badge>
                    <Badge variant="secondary">
                      {task.rules?.length || 0} rules
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(task)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(task.id)}
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

export const SettingsAssistantAgent: React.FC = () => {
  const [activeTab, setActiveTab] = useState("agents");
  const [editingAgent, setEditingAgent] = useState<PromptTemplate | undefined>();
  const [managingAgent, setManagingAgent] = useState<PromptTemplate | undefined>();
  const [editingTask, setEditingTask] = useState<PromptTemplate | undefined>();

  const {
    loadPromptTemplates,
    addPromptTemplate,
    updatePromptTemplate,
    deletePromptTemplate,
    getAgents,
    getTasksForAgent,
  } = usePromptTemplateStore(
    useShallow((state) => ({
      loadPromptTemplates: state.loadPromptTemplates,
      addPromptTemplate: state.addPromptTemplate,
      updatePromptTemplate: state.updatePromptTemplate,
      deletePromptTemplate: state.deletePromptTemplate,
      getAgents: state.getAgents,
      getTasksForAgent: state.getTasksForAgent,
    }))
  );

  useEffect(() => {
    loadPromptTemplates();
  }, [loadPromptTemplates]);

  // Get agents and tasks
  const agents = getAgents();
  const managingAgentTasks = managingAgent ? getTasksForAgent(managingAgent.id) : [];

  const handleCreateAgent = async (data: AgentFormData) => {
    await addPromptTemplate({
      ...data,
      type: "agent",
      isPublic: false,
    });
  };

  const handleUpdateAgent = async (data: AgentFormData) => {
    if (!editingAgent) return;
    await updatePromptTemplate(editingAgent.id, data);
  };

  const handleDeleteAgent = async (id: string) => {
    if (confirm("Are you sure you want to delete this agent and all its tasks?")) {
      // First delete all tasks for this agent
      const tasks = getTasksForAgent(id);
      for (const task of tasks) {
        await deletePromptTemplate(task.id);
      }
      // Then delete the agent
      await deletePromptTemplate(id);
    }
  };

  const handleCreateTask = async (data: TaskFormData) => {
    if (!managingAgent) return;
    await addPromptTemplate({
      ...data,
      type: "task",
      parentId: managingAgent.id,
      isPublic: false,
    });
  };

  const handleUpdateTask = async (data: TaskFormData) => {
    if (!editingTask || !managingAgent) return;
    await updatePromptTemplate(editingTask.id, {
      ...data,
      parentId: managingAgent.id,
    });
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm("Are you sure you want to delete this task?")) {
      await deletePromptTemplate(id);
    }
  };

  const handleEditAgent = (agent: PromptTemplate) => {
    setEditingAgent(agent);
    setActiveTab("edit-agent");
  };

  const handleManageTasks = (agent: PromptTemplate) => {
    setManagingAgent(agent);
    setActiveTab("manage-tasks");
  };

  const handleEditTask = (task: PromptTemplate) => {
    setEditingTask(task);
    setActiveTab("edit-task");
  };

  const handleNewTask = () => {
    setEditingTask(undefined);
    setActiveTab("new-task");
  };

  const handleFormSuccess = () => {
    setActiveTab("agents");
    setEditingAgent(undefined);
    setManagingAgent(undefined);
    setEditingTask(undefined);
  };

  const handleBackToAgents = () => {
    setActiveTab("agents");
    setManagingAgent(undefined);
    setEditingTask(undefined);
  };

  const handleBackToTasks = () => {
    setActiveTab("manage-tasks");
    setEditingTask(undefined);
  };

  const tabs: TabDefinition[] = [
    {
      value: "agents",
      label: "Agents",
      content: (
        <AgentList
          agents={agents}
          onEdit={handleEditAgent}
          onDelete={handleDeleteAgent}
          onManageTasks={handleManageTasks}
        />
      ),
    },
    {
      value: "new-agent",
      label: "New Agent",
      content: (
        <AgentForm
          key="new-agent-form"
          onSubmit={handleCreateAgent}
          onSuccess={handleFormSuccess}
        />
      ),
    },
  ];

  // Add edit agent tab dynamically when editing
  if (editingAgent) {
    tabs.push({
      value: "edit-agent",
      label: `Edit: ${editingAgent.name}`,
      content: (
        <AgentForm
          key={`edit-agent-form-${editingAgent.id}`}
          agent={editingAgent}
          onSubmit={handleUpdateAgent}
          onSuccess={handleFormSuccess}
        />
      ),
    });
  }

  // Add manage tasks tab dynamically when managing
  if (managingAgent) {
    tabs.push({
      value: "manage-tasks",
      label: `Tasks: ${managingAgent.name}`,
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBackToAgents}>
              ← Back to Agents
            </Button>
          </div>
          <TaskList
            agent={managingAgent}
            tasks={managingAgentTasks}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
            onNewTask={handleNewTask}
          />
        </div>
      ),
    });
  }

  // Add new task tab dynamically when creating task
  if (managingAgent && activeTab === "new-task") {
    tabs.push({
      value: "new-task",
      label: "New Task",
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBackToTasks}>
              ← Back to Tasks
            </Button>
          </div>
          <TaskForm
            key={`new-task-form-${managingAgent.id}`}
            agentId={managingAgent.id}
            onSubmit={handleCreateTask}
            onSuccess={handleBackToTasks}
          />
        </div>
      ),
    });
  }

  // Add edit task tab dynamically when editing task
  if (editingTask && managingAgent) {
    tabs.push({
      value: "edit-task",
      label: `Edit: ${editingTask.name}`,
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBackToTasks}>
              ← Back to Tasks
            </Button>
          </div>
          <TaskForm
            key={`edit-task-form-${editingTask.id}`}
            task={editingTask}
            agentId={managingAgent.id}
            onSubmit={handleUpdateTask}
            onSuccess={handleBackToTasks}
          />
        </div>
      ),
    });
  }

  return (
    <TabbedLayout
      tabs={tabs}
      initialValue={activeTab}
      onValueChange={setActiveTab}
      defaultValue="agents"
      contentContainerClassName="pb-2 sm:pb-6 pr-1 sm:pr-2 -mr-1 sm:-mr-2"
      scrollable={false}
    />
  );
}; 