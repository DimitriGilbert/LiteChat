import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { WorkflowControlModule } from "@/controls/modules/WorkflowControlModule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Workflow, Plus, Save, GitFork, Edit } from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import type { WorkflowStep, WorkflowTemplate } from "@/types/litechat/workflow";
import { WorkflowStepCard } from "./WorkflowStepCard";
import { WorkflowList } from "./WorkflowList";
import { WorkflowVisualizer } from "./WorkflowVisualizer";
import { WorkflowRawEditor } from "./WorkflowRawEditor";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormedible } from "@/hooks/use-formedible";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { TabbedLayout } from "@/components/LiteChat/common/TabbedLayout";
import { PersistenceService } from "@/services/persistence.service";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { useForm } from "@tanstack/react-form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

interface WorkflowBuilderProps {
  module: WorkflowControlModule;
}

type TriggerType = "custom" | "template" | "task";
type ActiveTab = "list" | "builder";

const createEmptyWorkflow = (): WorkflowTemplate => ({
  id: "",
  name: "My New Workflow",
  description: "A workflow for processing things.",
  steps: [],
  createdAt: "",
  updatedAt: "",
});

// Separate form component for workflow metadata - manages its own state
const WorkflowMetadataForm = React.forwardRef<
  {
    getData: () => { name: string; description: string };
    reset: (data: { name: string; description: string }) => void;
  },
  { initialData: { name: string; description: string } }
>(({ initialData }, ref) => {
  const metadataForm = useForm({
    defaultValues: initialData,
  });

  // Expose getData and reset methods via ref
  React.useImperativeHandle(ref, () => ({
    getData: () => metadataForm.state.values,
    reset: (data: { name: string; description: string }) => {
      metadataForm.setFieldValue("name", data.name);
      metadataForm.setFieldValue("description", data.description);
    },
  }));

  // Only set initial values on mount, don't reset on prop changes
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      metadataForm.setFieldValue("name", initialData.name);
      metadataForm.setFieldValue("description", initialData.description);
      mountedRef.current = true;
    }
  }, [initialData.name, initialData.description, metadataForm]);

  return (
    <div className="space-y-4">
      <metadataForm.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="wf-name">Workflow Name</Label>
            <Input
              id="wf-name"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
          </div>
        )}
      </metadataForm.Field>

      <metadataForm.Field name="description">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="wf-desc">Description</Label>
            <Textarea
              id="wf-desc"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              rows={3}
            />
          </div>
        )}
      </metadataForm.Field>
    </div>
  );
});

WorkflowMetadataForm.displayName = "WorkflowMetadataForm";

// Separate form component for trigger configuration - manages its own state
const TriggerConfigForm = React.forwardRef<
  {
    getData: () => {
      triggerType: TriggerType;
      customPrompt: string;
      selectedTemplateId: string;
      templateVariables: Record<string, any>;
    };
    getCompiledPrompt: () => Promise<string>;
    reset: (data: {
      triggerType: TriggerType;
      customPrompt: string;
      selectedTemplateId: string;
      templateVariables: Record<string, any>;
    }) => void;
  },
  {
    initialData: {
      triggerType: TriggerType;
      customPrompt: string;
      selectedTemplateId: string;
      templateVariables: Record<string, any>;
    };
    promptTemplates: any[];
    agentTasks: any[];
    module: WorkflowControlModule;
  }
>(({ initialData, promptTemplates, agentTasks, module }, ref) => {
  const triggerForm = useForm({
    defaultValues: initialData,
  });

  // Use state subscription to ensure UI updates when form state changes
  const [currentValues, setCurrentValues] = useState(triggerForm.state.values);

  useEffect(() => {
    const unsubscribe = triggerForm.store.subscribe(() => {
      setCurrentValues(triggerForm.state.values);
    });
    return unsubscribe;
  }, [triggerForm]);
  const selectedTemplate =
    currentValues.triggerType === "template" && currentValues.selectedTemplateId
      ? promptTemplates.find((t) => t.id === currentValues.selectedTemplateId)
      : null;
  const selectedTask =
    currentValues.triggerType === "task" && currentValues.selectedTemplateId
      ? agentTasks.find((t) => t.id === currentValues.selectedTemplateId)
      : null;

  const templateVariableFormRef = useRef<{
    getData: () => Record<string, any>;
  } | null>(null);

  // Expose getData methods via ref
  React.useImperativeHandle(ref, () => ({
    getData: () => {
      const formData = triggerForm.state.values;
      const templateVars = templateVariableFormRef.current?.getData() || {};
      return {
        ...formData,
        templateVariables: templateVars,
      };
    },
    getCompiledPrompt: async () => {
      const data = triggerForm.state.values;
      const templateVars = templateVariableFormRef.current?.getData() || {};

      if (data.triggerType === "custom") {
        return data.customPrompt;
      } else if (
        data.triggerType === "template" &&
        data.selectedTemplateId &&
        selectedTemplate
      ) {
        try {
          const compiled = await module.compileTemplate(
            selectedTemplate.id,
            templateVars
          );
          return compiled.content;
        } catch (error) {
          return `Error: ${
            error instanceof Error ? error.message : "Compilation failed"
          }`;
        }
      } else if (
        data.triggerType === "task" &&
        data.selectedTemplateId &&
        selectedTask
      ) {
        return selectedTask.prompt;
      }
      return "";
    },
    reset: (data) => {
      triggerForm.setFieldValue("triggerType", data.triggerType);
      triggerForm.setFieldValue("customPrompt", data.customPrompt);
      triggerForm.setFieldValue("selectedTemplateId", data.selectedTemplateId);
      triggerForm.setFieldValue("templateVariables", data.templateVariables);
      setCurrentValues(data); // Update local state too
    },
  }));

  // Only set initial values on mount, don't reset on prop changes
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      triggerForm.setFieldValue("triggerType", initialData.triggerType);
      triggerForm.setFieldValue("customPrompt", initialData.customPrompt);
      triggerForm.setFieldValue(
        "selectedTemplateId",
        initialData.selectedTemplateId
      );
      triggerForm.setFieldValue(
        "templateVariables",
        initialData.templateVariables
      );
      mountedRef.current = true;
    }
  }, [initialData, triggerForm.setFieldValue]);

  const templatesForTrigger =
    currentValues.triggerType === "template" ? promptTemplates : agentTasks;

  return (
    <div className="border rounded-md p-3 space-y-4">
      <Label className="font-semibold">Trigger / Initial Message</Label>

      <triggerForm.Field name="triggerType">
        {(field) => (
          <RadioGroup
            value={field.state.value}
            onValueChange={(value) => {
              field.handleChange(value as TriggerType);
              triggerForm.setFieldValue("selectedTemplateId", "");
              triggerForm.setFieldValue("templateVariables", {});
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="r-custom" />
              <Label htmlFor="r-custom">Custom Prompt</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="template" id="r-template" />
              <Label htmlFor="r-template">Prompt from Template</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="task" id="r-task" />
              <Label htmlFor="r-task">Agent Task</Label>
            </div>
          </RadioGroup>
        )}
      </triggerForm.Field>

      {currentValues.triggerType === "custom" && (
        <triggerForm.Field name="customPrompt">
          {(field) => (
            <Textarea
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Enter the first message to start the workflow..."
              className="min-h-[100px]"
            />
          )}
        </triggerForm.Field>
      )}

      {(currentValues.triggerType === "template" ||
        currentValues.triggerType === "task") && (
        <div className="space-y-2">
          <triggerForm.Field name="selectedTemplateId">
            {(field) => (
              <Select
                value={field.state.value}
                onValueChange={(value) => {
                  field.handleChange(value);
                  triggerForm.setFieldValue("templateVariables", {});
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={`Select a ${currentValues.triggerType}...`}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templatesForTrigger.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {currentValues.triggerType === "task"
                        ? (t as any).prefixedName
                        : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </triggerForm.Field>

          {/* Template Variable Form using useFormedible */}
          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <TemplateVariableFormWrapper
              key={selectedTemplate.id} // Remount when template changes
              ref={templateVariableFormRef}
              template={selectedTemplate}
              initialVariables={currentValues.templateVariables}
              module={module}
            />
          )}
        </div>
      )}
    </div>
  );
});

TriggerConfigForm.displayName = "TriggerConfigForm";

// Wrapper for template variables using useFormedible
const TemplateVariableFormWrapper = React.forwardRef<
  { getData: () => Record<string, any> },
  {
    template: any;
    initialVariables: Record<string, any>;
    module: WorkflowControlModule;
  }
>(({ template, initialVariables, module }, ref) => {
  const [formData, setFormData] = useState(initialVariables);
  const previewRef = useRef<HTMLDivElement>(null);

  // Expose getData method via ref
  React.useImperativeHandle(ref, () => ({
    getData: () => formData,
  }));

  const templateFields = useMemo(() => {
    return template.variables.map((v: any) => ({
      name: v.name,
      type: v.type || "text",
      label: v.name,
      placeholder: v.description,
      description: v.instructions,
      required: v.required,
    }));
  }, [template.variables]);

  const { Form } = useFormedible({
    fields: templateFields,
    formOptions: {
      defaultValues: initialVariables,
      onChange: async ({ value }) => {
        // ONLY direct DOM update for live preview - NO state updates to prevent re-renders
        if (previewRef.current) {
          try {
            const compiled = await module.compileTemplate(template.id, value);
            previewRef.current.textContent = compiled.content;
          } catch (error) {
            const errorMessage = `Error: ${
              error instanceof Error ? error.message : "Compilation failed"
            }`;
            previewRef.current.textContent = errorMessage;
          }
        }
      },
      onBlur: async ({ value }) => {
        // Update state ONLY on blur to capture data without causing re-renders during typing
        setFormData(value);
      },
    },
    showSubmitButton: false,
    formClassName: "space-y-4 mt-4 border-t pt-4",
  });

  // Initialize preview and form data
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.textContent = template.prompt;
    }
    setFormData(initialVariables);

    // If we have initial variables and template, compile the preview
    if (Object.keys(initialVariables).length > 0) {
      module
        .compileTemplate(template.id, initialVariables)
        .then((compiled) => {
          if (previewRef.current) {
            previewRef.current.textContent = compiled.content;
          }
        })
        .catch((error) => {
          if (previewRef.current) {
            const errorMessage = `Error: ${
              error instanceof Error ? error.message : "Compilation failed"
            }`;
            previewRef.current.textContent = errorMessage;
          }
        });
    }
  }, [template.id, template.prompt, initialVariables, module.compileTemplate]); // Re-run when template changes

  return (
    <div>
      <Form />
      <div className="mt-4 border rounded-lg p-3">
        <Label className="text-sm font-medium">Live Preview</Label>
        <div
          ref={previewRef}
          className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap max-h-32 overflow-y-auto"
        >
          {template.prompt}
        </div>
      </div>
    </div>
  );
});

TemplateVariableFormWrapper.displayName = "TemplateVariableFormWrapper";

// Separate form component for steps management - manages its own state
const StepsForm = React.forwardRef<
  {
    getData: () => WorkflowStep[];
    reset: (steps: WorkflowStep[]) => void;
  },
  {
    initialSteps: WorkflowStep[];
    promptTemplates: any[];
    agentTasks: any[];
    models: any[];
    tools: Array<{ name: string; description?: string }>;
    module: any;
    currentWorkflow: WorkflowTemplate;
  }
>(
  (
    {
      initialSteps,
      promptTemplates,
      agentTasks,
      models,
      tools,
      module,
      currentWorkflow,
    },
    ref
  ) => {
    const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);

    // Expose getData and reset methods via ref
    React.useImperativeHandle(ref, () => ({
      getData: () => steps,
      reset: (newSteps: WorkflowStep[]) => {
        setSteps(newSteps);
      },
    }));

    // Only set initial steps on mount, don't reset on prop changes
    const mountedRef = useRef(false);
    useEffect(() => {
      if (!mountedRef.current) {
        setSteps(initialSteps);
        mountedRef.current = true;
      }
    }, [initialSteps]);

    // Drag and drop sensors - configured for modal usage
    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8, // Require 8px movement before drag starts
        },
      }),
      useSensor(TouchSensor, {
        activationConstraint: {
          delay: 200,
          tolerance: 8,
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const handleAddStep = useCallback(() => {
      const newStep: WorkflowStep = {
        id: nanoid(),
        name: `Step ${steps.length + 1}`,
        type: "prompt",
        modelId: "",
        templateId: undefined,
      };
      setSteps((prev) => [...prev, newStep]);
    }, [steps.length]);

    const handleStepChange = useCallback(
      (index: number, updatedStep: WorkflowStep) => {
        setSteps((prev) => {
          const newSteps = [...prev];
          newSteps[index] = updatedStep;
          return newSteps;
        });
      },
      []
    );

    const handleStepDelete = useCallback((index: number) => {
      setSteps((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // Step reordering handlers
    const handleMoveStep = useCallback((fromIndex: number, toIndex: number) => {
      setSteps((prev) => arrayMove(prev, fromIndex, toIndex));
    }, []);

    const handleMoveToTop = useCallback(
      (index: number) => {
        if (index > 0) {
          handleMoveStep(index, 0);
        }
      },
      [handleMoveStep]
    );

    const handleMoveUp = useCallback(
      (index: number) => {
        if (index > 0) {
          handleMoveStep(index, index - 1);
        }
      },
      [handleMoveStep]
    );

    const handleMoveDown = useCallback(
      (index: number) => {
        if (index < steps.length - 1) {
          handleMoveStep(index, index + 1);
        }
      },
      [handleMoveStep, steps.length]
    );

    // Drag handlers
    const handleDragStart = useCallback((event: DragStartEvent) => {
      // console.log('🐛 [WorkflowBuilder] DragStart:', {
      //     activeId: event.active.id,
      //     event
      // });
      setActiveStepId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
          const activeIndex = steps.findIndex((step) => step.id === active.id);
          const overIndex = steps.findIndex((step) => step.id === over.id);

          if (activeIndex !== -1 && overIndex !== -1) {
            handleMoveStep(activeIndex, overIndex);
          }
        }
        setActiveStepId(null);
      },
      [steps, handleMoveStep]
    );

    const handleDragCancel = useCallback(() => {
      // console.log('🐛 [WorkflowBuilder] DragCancel');
      setActiveStepId(null);
    }, []);

    const stepIds = useMemo(() => steps.map((step) => step.id), [steps]);

    // console.log('🐛 [WorkflowBuilder] Component render:', {
    //     stepsCount: steps.length,
    //     activeStepId,
    //     stepIds,
    //     sensors: sensors.length
    // });

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        modifiers={[]}
      >
        <div className="h-full flex flex-col border rounded-md p-3">
          <div className="space-y-4">
            <SortableContext
              items={stepIds}
              strategy={verticalListSortingStrategy}
            >
              {steps.map((step, index) => (
                <WorkflowStepCard
                  key={step.id}
                  step={step}
                  onChange={(updatedStep: WorkflowStep) =>
                    handleStepChange(index, updatedStep)
                  }
                  onDelete={() => handleStepDelete(index)}
                  onMoveToTop={() => handleMoveToTop(index)}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  promptTemplates={promptTemplates}
                  agentTasks={agentTasks}
                  models={models}
                  tools={tools}
                  module={module}
                  workflow={currentWorkflow}
                  stepIndex={index}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                />
              ))}
            </SortableContext>
            {steps.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No subsequent steps. Add one to create a sequence.
              </div>
            )}
            <Button size="sm" onClick={handleAddStep} className="w-full mt-4">
              <Plus className="h-4 w-4 mr-2" /> Add Step
            </Button>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeStepId ? (
            <WorkflowStepCard
              step={steps.find((s) => s.id === activeStepId)!}
              onChange={() => {}}
              onDelete={() => {}}
              promptTemplates={promptTemplates}
              agentTasks={agentTasks}
              models={models}
              tools={tools}
              module={module}
              workflow={currentWorkflow}
              stepIndex={steps.findIndex((s) => s.id === activeStepId)}
              isFirst={false}
              isLast={false}
              isDragDisabled={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }
);

StepsForm.displayName = "StepsForm";

export const WorkflowBuilder: React.FC<WorkflowBuilderProps> = ({ module }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("list");
  const [activeStepsTab, setActiveStepsTab] = useState<string>("builder");
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowTemplate>(
    createEmptyWorkflow()
  );
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  // Initial form data - only for initialization, not maintained reactively
  const [initialMetadata, setInitialMetadata] = useState({
    name: currentWorkflow.name,
    description: currentWorkflow.description,
  });

  const [initialTrigger, setInitialTrigger] = useState({
    triggerType: (currentWorkflow.triggerType as TriggerType) || "custom",
    customPrompt: currentWorkflow.triggerPrompt || "",
    selectedTemplateId: currentWorkflow.triggerRef || "",
    templateVariables: currentWorkflow.templateVariables || {},
  });

  const [initialSteps, setInitialSteps] = useState<WorkflowStep[]>(
    currentWorkflow.steps || []
  );

  // Refs to access form data when needed
  const metadataFormRef = useRef<{
    getData: () => { name: string; description: string };
    reset: (data: { name: string; description: string }) => void;
  } | null>(null);
  const triggerFormRef = useRef<{
    getData: () => {
      triggerType: TriggerType;
      customPrompt: string;
      selectedTemplateId: string;
      templateVariables: Record<string, any>;
    };
    getCompiledPrompt: () => Promise<string>;
    reset: (data: {
      triggerType: TriggerType;
      customPrompt: string;
      selectedTemplateId: string;
      templateVariables: Record<string, any>;
    }) => void;
  } | null>(null);
  const stepsFormRef = useRef<{
    getData: () => WorkflowStep[];
    reset: (steps: WorkflowStep[]) => void;
  } | null>(null);

  // Cache for visualizer data - only updated when switching to visualizer tab
  const [visualizerData, setVisualizerData] = useState<{
    workflow: WorkflowTemplate;
    initialStepData: any;
    stepDisplayData: any[];
  } | null>(null);

  // Check streaming status from store
  const isStreaming = useInteractionStore(
    (state) => state.streamingInteractionIds.length > 0
  );

  // Get data from module
  const promptTemplates = module.getPromptTemplates();
  const agentTasks = module.getAgentTasks();
  const models = module.getModels();
  // Get available tools from control registry
  const controlRegistry = useControlRegistryStore();
  const tools = Object.keys(controlRegistry.tools).map((toolName) => ({
    name: toolName,
    description: controlRegistry.tools[toolName]?.definition?.description,
  }));

  // Function to gather all form data when needed
  const gatherFormData = useCallback(async (): Promise<{
    metadata: { name: string; description: string };
    trigger: {
      triggerType: TriggerType;
      customPrompt: string;
      selectedTemplateId: string;
      templateVariables: Record<string, any>;
    };
    compiledPrompt: string;
    steps: WorkflowStep[];
  }> => {
    const metadata = metadataFormRef.current?.getData() || initialMetadata;
    const trigger = triggerFormRef.current?.getData() || initialTrigger;
    const compiledPrompt = await (triggerFormRef.current?.getCompiledPrompt() ||
      Promise.resolve(""));
    const steps = stepsFormRef.current?.getData() || initialSteps;

    return { metadata, trigger, compiledPrompt, steps };
  }, [initialMetadata, initialTrigger, initialSteps]);

  // Function to build workflow from gathered data
  const buildWorkflow = useCallback(async (): Promise<WorkflowTemplate> => {
    const { metadata, trigger, compiledPrompt, steps } = await gatherFormData();

    return {
      ...currentWorkflow,
      name: metadata.name,
      description: metadata.description,
      triggerType: trigger.triggerType,
      triggerPrompt: compiledPrompt,
      triggerRef:
        trigger.triggerType !== "custom"
          ? trigger.selectedTemplateId
          : undefined,
      templateVariables: trigger.templateVariables,
      steps: steps,
    };
  }, [currentWorkflow, gatherFormData]);

  const resetWorkflow = () => {
    const emptyWorkflow = createEmptyWorkflow();
    const newMetadata = {
      name: emptyWorkflow.name,
      description: emptyWorkflow.description,
    };
    const newTrigger = {
      triggerType: "custom" as TriggerType,
      customPrompt: "",
      selectedTemplateId: "",
      templateVariables: {},
    };
    const newSteps: WorkflowStep[] = [];

    setCurrentWorkflow(emptyWorkflow);
    setInitialMetadata(newMetadata);
    setInitialTrigger(newTrigger);
    setInitialSteps(newSteps);
    setIsEditingExisting(false);
    setVisualizerData(null);

    // Reset all forms
    metadataFormRef.current?.reset(newMetadata);
    triggerFormRef.current?.reset(newTrigger);
    stepsFormRef.current?.reset(newSteps);
  };

  const handleCreateNew = () => {
    resetWorkflow();
    setActiveTab("builder");
  };

  const handleEditWorkflow = (existingWorkflow: WorkflowTemplate) => {
    // Set editing mode and load existing workflow data
    setIsEditingExisting(true);
    setCurrentWorkflow(existingWorkflow);

    const newMetadata = {
      name: existingWorkflow.name,
      description: existingWorkflow.description,
    };

    const newTrigger = {
      triggerType: existingWorkflow.triggerType || ("custom" as TriggerType),
      customPrompt: existingWorkflow.triggerPrompt || "",
      selectedTemplateId: existingWorkflow.triggerRef || "",
      templateVariables: existingWorkflow.templateVariables || {},
    };

    const newSteps = existingWorkflow.steps || [];

    setInitialMetadata(newMetadata);
    setInitialTrigger(newTrigger);
    setInitialSteps(newSteps);

    setActiveTab("builder");
    setVisualizerData(null);

    // Reset forms with the workflow data after a small delay to ensure components are mounted
    // setTimeout(() => {
    //   metadataFormRef.current?.reset(newMetadata);
    //   triggerFormRef.current?.reset(newTrigger);
    //   stepsFormRef.current?.reset(newSteps);
    // }, 100);

    setOpen(true);
  };

  const handleSaveWorkflow = async () => {
    // Gather all current form data before saving
    const { metadata, trigger, steps } = await gatherFormData();

    // Update initial data to preserve current form state
    setInitialMetadata(metadata);
    setInitialTrigger(trigger);
    setInitialSteps(steps);

    if (!metadata.name.trim()) {
      toast.error("Workflow name cannot be empty.");
      return;
    }

    try {
      const now = new Date().toISOString();
      const workflowToSave = await buildWorkflow();
      workflowToSave.id = currentWorkflow.id || nanoid();
      workflowToSave.createdAt = currentWorkflow.createdAt || now;
      workflowToSave.updatedAt = now;

      await PersistenceService.saveWorkflow(workflowToSave);
      setCurrentWorkflow(workflowToSave);
      setIsEditingExisting(true);
      await module.refreshWorkflows();
      toast.success(`Saved workflow "${workflowToSave.name}"`);
    } catch (error) {
      console.error("Failed to save workflow:", error);
      toast.error("Failed to save workflow");
    }
  };

  const handleForkWorkflow = async () => {
    // Gather all current form data before forking
    const { metadata, trigger, steps } = await gatherFormData();

    // Update initial data to preserve current form state
    setInitialMetadata(metadata);
    setInitialTrigger(trigger);
    setInitialSteps(steps);

    if (!metadata.name.trim()) {
      toast.error("Workflow name cannot be empty.");
      return;
    }

    try {
      const now = new Date().toISOString();
      const forkedWorkflow = await buildWorkflow();
      forkedWorkflow.id = nanoid();
      forkedWorkflow.name = `${metadata.name} (Fork)`;
      forkedWorkflow.createdAt = now;
      forkedWorkflow.updatedAt = now;

      await PersistenceService.saveWorkflow(forkedWorkflow);
      setCurrentWorkflow(forkedWorkflow);
      setInitialMetadata({
        name: forkedWorkflow.name,
        description: forkedWorkflow.description,
      });
      setIsEditingExisting(true);
      await module.refreshWorkflows();
      toast.success(`Forked workflow as "${forkedWorkflow.name}"`);
    } catch (error) {
      console.error("Failed to fork workflow:", error);
      toast.error("Failed to fork workflow");
    }
  };

  const handleRunWorkflow = async () => {
    const { trigger, steps } = await gatherFormData();

    if (trigger.triggerType === "custom") {
      if (!trigger.customPrompt) {
        toast.error("Custom prompt cannot be empty.");
        return;
      }
    } else {
      if (!trigger.selectedTemplateId) {
        toast.error("Please select a template or task.");
        return;
      }
    }

    if (steps.length === 0) {
      toast.error("Workflow must have at least one step.");
      return;
    }

    try {
      const workflowToRun = await buildWorkflow();
      await module.startWorkflow(
        workflowToRun,
        workflowToRun.triggerPrompt || ""
      );
      setOpen(false);
      toast.success("Workflow started!");
    } catch (error) {
      console.error("Failed to run workflow:", error);
      toast.error("Failed to start workflow");
    }
  };

  // Update visualizer data when switching to visualizer tab
  const handleStepsTabChange = useCallback(
    async (value: string) => {
      // ALWAYS gather form data before tab change to preserve state
      try {
        const { metadata, trigger, steps } = await gatherFormData();

        // Update our initial data with current form values to prevent reset
        setInitialMetadata(metadata);
        setInitialTrigger(trigger);
        setInitialSteps(steps);
      } catch (error) {
        console.error("Failed to gather form data before tab change:", error);
      }

      setActiveStepsTab(value);

      if (value === "visualizer" || value === "raw") {
        try {
          const { trigger, steps } = await gatherFormData();
          const workflow = await buildWorkflow();

          // Get selected template/task for visualizer
          const selectedTemplate =
            trigger.triggerType === "template" && trigger.selectedTemplateId
              ? promptTemplates.find((t) => t.id === trigger.selectedTemplateId)
              : null;
          const selectedTask =
            trigger.triggerType === "task" && trigger.selectedTemplateId
              ? agentTasks.find((t) => t.id === trigger.selectedTemplateId)
              : null;

          // Process initial step data for visualizer
          let initialStepData: any;
          if (trigger.triggerType === "custom" && trigger.customPrompt) {
            const preview =
              trigger.customPrompt.length > 100
                ? trigger.customPrompt.slice(0, 100) + "..."
                : trigger.customPrompt;
            initialStepData = {
              stepName: "Custom Prompt",
              templateName: preview,
              type: "initial",
              previewContent: preview,
            };
          } else if (
            trigger.triggerType === "template" &&
            trigger.selectedTemplateId &&
            selectedTemplate
          ) {
            const contentToShow =
              workflow.triggerPrompt || selectedTemplate.prompt;
            const preview =
              contentToShow.length > 100
                ? contentToShow.slice(0, 100) + "..."
                : contentToShow;
            initialStepData = {
              stepName: selectedTemplate.name,
              templateName: preview,
              type: "initial",
              previewContent: preview,
            };
          } else if (
            trigger.triggerType === "task" &&
            trigger.selectedTemplateId &&
            selectedTask
          ) {
            const preview =
              selectedTask.prompt.length > 100
                ? selectedTask.prompt.slice(0, 100) + "..."
                : selectedTask.prompt;
            initialStepData = {
              stepName: selectedTask.name,
              templateName: preview,
              type: "initial",
              previewContent: preview,
            };
          } else {
            initialStepData = {
              stepName: "Initial Step",
              templateName: undefined,
              type: "initial",
              previewContent: undefined,
            };
          }

          // Process step display data for visualizer
          const stepDisplayData = steps.map((step) => {
            const getCleanModelName = () => {
              if (!step.modelId) return undefined;
              const model = models.find((m) => m.id === step.modelId);
              return model ? model.name : step.modelId;
            };

            const getTemplateName = () => {
              if (step.templateId) {
                if (step.type === "prompt") {
                  const template = promptTemplates.find(
                    (t) => t.id === step.templateId
                  );
                  return template?.name;
                } else if (step.type === "agent-task") {
                  const task = agentTasks.find((t) => t.id === step.templateId);
                  return task?.name;
                }
              }
              return undefined;
            };

            return {
              stepName: step.name || "Unnamed Step",
              templateName: getTemplateName(),
              modelName: getCleanModelName(),
              type: step.type,
            };
          });

          setVisualizerData({
            workflow,
            initialStepData,
            stepDisplayData,
          });
        } catch (error) {
          console.error("Failed to gather data for visualizer:", error);
        }
      }
    },
    [gatherFormData, buildWorkflow, promptTemplates, agentTasks, models]
  );

  const tabs = [
    {
      value: "list",
      label: "Workflows",
      content: (
        <WorkflowList
          module={module}
          onEditWorkflow={handleEditWorkflow}
          onCreateNew={handleCreateNew}
          onWorkflowsChanged={() => module.refreshWorkflows()}
          onWorkflowRun={() => setOpen(false)}
        />
      ),
    },
    {
      value: "builder",
      label: isEditingExisting ? "Edit Workflow" : "New Workflow",
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-full overflow-hidden p-1 md:p-2">
          {/* Left Side: Trigger & Workflow Config - Responsive column spans */}
          <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 flex flex-col gap-3 md:gap-4 overflow-y-auto max-h-full">
            <WorkflowMetadataForm
              ref={metadataFormRef}
              initialData={initialMetadata}
            />

            <TriggerConfigForm
              ref={triggerFormRef}
              initialData={initialTrigger}
              promptTemplates={promptTemplates}
              agentTasks={agentTasks}
              module={module}
            />
          </div>

          {/* Right Side: Steps with Tabbed Layout - Responsive column spans */}
          <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-9 flex flex-col h-full">
            <Label className="mb-2">Workflow Steps</Label>
            <div className="flex-1 min-h-0">
              <TabbedLayout
                onValueChange={handleStepsTabChange}
                tabs={[
                  {
                    value: "builder",
                    label: "Builder",
                    content: (
                      <StepsForm
                        ref={stepsFormRef}
                        initialSteps={initialSteps}
                        promptTemplates={promptTemplates}
                        agentTasks={agentTasks}
                        models={models}
                        tools={tools}
                        module={module}
                        currentWorkflow={currentWorkflow}
                      />
                    ),
                  },
                  {
                    value: "visualizer",
                    label: "Visualizer",
                    content: (
                      <div className="w-full border rounded-md overflow-hidden">
                        {visualizerData ? (
                          <div className="w-full">
                            <WorkflowVisualizer
                              workflow={visualizerData.workflow}
                              initialStepData={visualizerData.initialStepData}
                              stepDisplayData={visualizerData.stepDisplayData}
                              className="w-full h-[65vh]"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-full text-muted-foreground">
                            Loading visualizer...
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    value: "raw",
                    label: "Raw Editor",
                    content: (
                      <div className="h-full border rounded-md">
                        {visualizerData ? (
                          <WorkflowRawEditor
                            workflow={visualizerData.workflow}
                            onChange={async (updatedWorkflow) => {
                              setInitialMetadata({
                                name: updatedWorkflow.name,
                                description: updatedWorkflow.description,
                              });
                              setInitialTrigger({
                                triggerType:
                                  (updatedWorkflow.triggerType as TriggerType) ||
                                  "custom",
                                customPrompt:
                                  updatedWorkflow.triggerPrompt || "",
                                selectedTemplateId:
                                  updatedWorkflow.triggerRef || "",
                                templateVariables:
                                  updatedWorkflow.templateVariables || {},
                              });
                              setInitialSteps(updatedWorkflow.steps);
                              // Update visualizer data as well
                              setVisualizerData((prev) =>
                                prev
                                  ? { ...prev, workflow: updatedWorkflow }
                                  : null
                              );
                            }}
                            onSave={async (updatedWorkflow) => {
                              const now = new Date().toISOString();
                              const workflowToSave: WorkflowTemplate = {
                                ...updatedWorkflow,
                                id: updatedWorkflow.id || nanoid(),
                                createdAt: updatedWorkflow.createdAt || now,
                                updatedAt: now,
                              };
                              await PersistenceService.saveWorkflow(
                                workflowToSave
                              );
                              setCurrentWorkflow(workflowToSave);
                              setIsEditingExisting(true);
                              await module.refreshWorkflows();
                            }}
                            className="h-full p-3"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            Loading editor...
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
                scrollable={false}
                className="h-full"
                initialValue={activeStepsTab}
              />
            </div>
          </div>
        </div>
      ),
    },
  ];

  const shortcutWorkflows = module.getShortcutWorkflows();
  const [searchTerm, setSearchTerm] = useState("");

  // Filter workflows based on search term
  const filteredWorkflows = shortcutWorkflows.filter(
    (workflow) =>
      workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (workflow.description ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  const checkIfWorkflowNeedsInput = useCallback(
    (workflow: WorkflowTemplate): boolean => {
      // Check if trigger needs input
      if (workflow.triggerType === "custom" && !workflow.triggerPrompt) {
        return true; // Custom trigger without prompt
      }

      if (workflow.triggerType === "template" && workflow.triggerRef) {
        // Check if template has variables that need values
        const template = module
          .getPromptTemplates()
          .find((t) => t.id === workflow.triggerRef);
        if (template && template.variables && template.variables.length > 0) {
          // Check if templateVariables has all required values
          const hasAllValues = template.variables.every((variable: any) => {
            const value = workflow.templateVariables?.[variable.name];
            return value !== undefined && value !== null && value !== "";
          });
          if (!hasAllValues) return true;
        }
      }

      // Workflow is ready to run
      return false;
    },
    [module]
  );

  const handleRunShortcutWorkflow = useCallback(
    (workflow: WorkflowTemplate) => {
      const needsInput = checkIfWorkflowNeedsInput(workflow);

      if (needsInput) {
        // Open builder for configuration - it already has a run button
        handleEditWorkflow(workflow);
      } else {
        // Run directly with sensible defaults
        const defaultPrompt = workflow.triggerPrompt || "Run workflow";
        module.startWorkflow(workflow, defaultPrompt);
        toast.success(`Workflow "${workflow.name}" started!`);
      }
    },
    [checkIfWorkflowNeedsInput, module, handleEditWorkflow]
  );

  return (
    <>
      {shortcutWorkflows.length > 0 ? (
        <HoverCard>
          <HoverCardTrigger asChild>
            <ActionTooltipButton
              tooltipText="Open Workflow Builder"
              onClick={() => setOpen(true)}
              aria-label="Open Workflow Builder"
              disabled={isStreaming}
              icon={<Workflow />}
              className="h-5 w-5 md:h-6 md:w-6"
            />
          </HoverCardTrigger>
          <HoverCardContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="font-semibold text-sm mb-2">Quick Workflows</h4>
              <Input
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredWorkflows.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    {searchTerm
                      ? "No workflows match your search"
                      : "No shortcut workflows available"}
                  </div>
                ) : (
                  filteredWorkflows.map((workflow) => {
                    const needsInput = checkIfWorkflowNeedsInput(workflow);

                    return (
                      <div
                        key={workflow.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors group"
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditWorkflow(workflow);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>

                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleRunShortcutWorkflow(workflow)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {workflow.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs px-1 py-0"
                            >
                              {workflow.steps.length}
                            </Badge>
                            {needsInput && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1 py-0"
                              >
                                Setup
                              </Badge>
                            )}
                          </div>
                          {workflow.description && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {workflow.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      ) : (
        <ActionTooltipButton
          tooltipText="Open Workflow Builder"
          onClick={() => setOpen(true)}
          aria-label="Open Workflow Builder"
          disabled={isStreaming}
          icon={<Workflow />}
          className="h-5 w-5 md:h-6 md:w-6"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="!w-[95vw] !h-[95vh] !max-w-none flex flex-col p-0"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-2 md:p-3 pb-1 md:pb-2 flex-shrink-0">
            <DialogTitle className="p-2">Workflow Builder</DialogTitle>
            <DialogDescription>
              Create and manage automated sequences of AI interactions.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-grow overflow-hidden">
            <TabbedLayout
              tabs={tabs}
              initialValue={activeTab}
              onValueChange={async (value) => {
                // Gather form data before tab change to preserve state
                if (activeTab === "builder" && value !== "builder") {
                  try {
                    const { metadata, trigger, steps } = await gatherFormData();
                    setInitialMetadata(metadata);
                    setInitialTrigger(trigger);
                    setInitialSteps(steps);
                  } catch (error) {
                    console.error(
                      "Failed to gather form data before main tab change:",
                      error
                    );
                  }
                }

                setActiveTab(value as ActiveTab);
                if (value === "list") {
                  module.refreshWorkflows();
                }
              }}
              scrollable={true}
            />
          </div>

          {activeTab === "builder" && (
            <DialogFooter className="p-1 sm:p-2 md:p-3 pt-0.5 sm:pt-1 md:pt-2">
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>

                {isEditingExisting && (
                  <Button
                    variant="outline"
                    onClick={handleForkWorkflow}
                    className="flex items-center gap-2"
                  >
                    <GitFork className="h-4 w-4" />
                    Fork
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={handleSaveWorkflow}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save
                </Button>

                <Button
                  onClick={handleRunWorkflow}
                  className="flex items-center gap-2"
                >
                  <Workflow className="h-4 w-4" />
                  Run Workflow
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
