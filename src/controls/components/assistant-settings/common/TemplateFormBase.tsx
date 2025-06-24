import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save } from "lucide-react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import type {
  PromptTemplate,
  PromptVariable,
} from "@/types/litechat/prompt-template";
import { ToolSelectorForm } from "@/controls/components/tool-selector/ToolSelectorForm";
import { RulesControlDialogContent } from "@/controls/components/rules/RulesControlDialogContent";
import { useRulesStore } from "@/store/rules.store";
import { useShallow } from "zustand/react/shallow";
import { VariableManager } from "../common/VariableManager";
import { FollowUpSelector } from "../common/FollowUpSelector";

export interface BaseTemplateFormData {
  name: string;
  description: string;
  variables: PromptVariable[];
  prompt: string;
  tags: string[];
  tools: string[];
  rules: string[];
  followUps?: string[];
  isShortcut?: boolean;
}

interface TemplateFormBaseProps {
  template?: PromptTemplate;
  onSubmit: (data: BaseTemplateFormData) => void;
  onSuccess: () => void;
  type: "prompt" | "agent" | "task";
  agentId?: string; // For tasks
  showFollowUps?: boolean;
  showMaxSteps?: boolean;
  followUpOptions?: PromptTemplate[];
  additionalActions?: React.ReactNode;
}

const createValidationSchema = () => {
  const schema = z.object({
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
    isShortcut: z.boolean().optional(),
  });
  
  return async ({ value }: { value: BaseTemplateFormData }) => {
    try {
      await schema.parseAsync(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.formErrors.fieldErrors;
      }
      return { root: "Validation failed" };
    }
  };
};

export const TemplateFormBase: React.FC<TemplateFormBaseProps> = ({
  template,
  onSubmit,
  onSuccess,
  type,
  showFollowUps = false,
  showMaxSteps = false,
  followUpOptions = [],
  additionalActions,
}) => {
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
      followUps: template?.followUps || [],
      isShortcut: template?.isShortcut || false,
    },
    validators: {
      onChangeAsync: createValidationSchema(),
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      onSubmit(value);
      onSuccess();
    },
  });

  const getRulesForTag = (tagId: string) => {
    const linkIds = tagRuleLinks
      .filter((link) => link.tagId === tagId)
      .map((link) => link.ruleId);
    return allRules.filter((rule) => linkIds.includes(rule.id));
  };

  const getTypeLabel = () => {
    switch (type) {
      case "agent": return "Agent";
      case "task": return "Task";
      default: return "Template";
    }
  };

  const getPromptLabel = () => {
    switch (type) {
      case "agent": return "Agent Prompt";
      case "task": return "Task Prompt";
      default: return "Prompt Template";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">
          {template ? `Edit ${getTypeLabel()}` : `New ${getTypeLabel()}`}
        </h3>
        <p className="text-sm text-muted-foreground">
          {template
            ? `Update your ${type}`
            : `Create a new ${type}${type === "prompt" ? " template with variables" : ""}`}
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
                <Label htmlFor={field.name}>{getTypeLabel()} Name</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={`Enter ${type} name`}
                />
                {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {field.state.meta.errors[0] || "Invalid input"}
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
                  placeholder={`Describe what this ${type} does`}
                  rows={3}
                />
              </div>
            )}
          />

          <form.Field
            name="isShortcut"
            children={(field) => (
              <div className="flex items-center space-x-2">
                <Switch
                  id={field.name}
                  checked={field.state.value || false}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
                <Label htmlFor={field.name} className="text-sm font-medium">
                  Show as shortcut
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, this {type} will appear in the quick access hover menu
                </p>
              </div>
            )}
          />

          <form.Field
            name="prompt"
            children={(field) => (
              <div>
                <Label htmlFor={field.name}>{getPromptLabel()}</Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={`Enter your ${type} prompt using {{ variable_name }} syntax`}
                  rows={6}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use double curly braces to reference variables:{" "}
                  {`{{ variable_name }}`}
                </p>
                {field.state.meta.errors && field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {field.state.meta.errors[0] || "Invalid input"}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        {/* Variables */}
        <form.Field
          name="variables"
          children={(field) => (
            <VariableManager
              variables={field.state.value}
              onVariablesChange={(variables: PromptVariable[]) => field.handleChange(variables)}
              templateId={template?.id}
            />
          )}
        />

        {/* Follow-ups (only for prompts and tasks) */}
        {showFollowUps && (
          <form.Field
            name="followUps"
            children={(field) => (
              <FollowUpSelector
                selectedFollowUps={field.state.value || []}
                onFollowUpsChange={(followUps: string[]) => field.handleChange(followUps)}
                followUpOptions={followUpOptions}
                templateId={template?.id}
              />
            )}
          />
        )}

        {/* Auto Tools */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Auto-select Tools</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Choose tools that will be automatically enabled when this {type}
              is applied.
            </p>
            <form.Field
              name="tools"
              children={(field) => (
                <ToolSelectorForm
                  selectedTools={field.state.value}
                  onToolsChange={(tools: string[]) => field.handleChange(tools)}
                  className="p-0 max-w-none"
                  maxSteps={maxSteps}
                  onMaxStepsChange={setMaxSteps}
                  showMaxSteps={showMaxSteps}
                />
              )}
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
              {type} is applied.
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
            {template ? `Update ${getTypeLabel()}` : `Create ${getTypeLabel()}`}
          </Button>
          {additionalActions}
        </div>
      </form>
    </div>
  );
}; 