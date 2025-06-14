import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bot, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFormedible } from "@/hooks/use-formedible";
import type { PromptTemplate, PromptFormData } from "@/types/litechat/prompt-template";
import LiteChatIcon from "@/components/LiteChat/common/icons/LiteChatIcon";

// Forward declare the module type to avoid circular import issues
interface AgentControlModule {
  compileTemplate: (templateId: string, formData: PromptFormData) => Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }>;
  compileTaskTemplate: (taskId: string, formData: PromptFormData) => Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }>;
  applyTemplate: (templateId: string, formData: PromptFormData) => Promise<void>;
  applyAgent: (agentId: string, formData: PromptFormData) => Promise<void>;
  applyAgentWithTask: (agentId: string, taskId: string, agentFormData: PromptFormData, taskFormData: PromptFormData) => Promise<void>;
  getCurrentAgentId: () => string | null;
  getCurrentAgentSystemPrompt: () => string | null;
  hasActiveAgent: () => boolean;
  setNotifyCallback: (cb: (() => void) | null) => void;
  clearOnSubmit?: () => void;
  getAutoClearEnabled: () => boolean;
  setAutoClearEnabled: (enabled: boolean) => void;
  // Module methods for data access
  getAgents: () => PromptTemplate[];
  getTasksForAgent: (agentId: string) => PromptTemplate[];
  loadPromptTemplates: () => void;
  getIsLoadingTemplates: () => boolean;
}

interface AgentControlProps {
  module: AgentControlModule;
}

function AgentSelector({ 
  agents, 
  onUseAgent,
  onClearAgent,
  hasActiveAgent,
  currentAgentName,
  module
}: { 
  agents: PromptTemplate[]; 
  onUseAgent: (agent: PromptTemplate) => void;
  onClearAgent: () => void;
  hasActiveAgent: boolean;
  currentAgentName?: string;
  module: AgentControlModule;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {hasActiveAgent && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Active Agent: {currentAgentName}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClearAgent}>
            Clear Agent
          </Button>
        </div>
      )}

      <div>
        <Label htmlFor="search">Search Agents</Label>
        <Input
          id="search"
          placeholder="Search by name, description, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filteredAgents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No agents match your search." : "No agents available."}
          </div>
        ) : (
          filteredAgents.map((agent) => {
            const tasks = module.getTasksForAgent(agent.id);
            return (
              <Card 
                key={agent.id} 
                className="hover:bg-muted/50 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {agent.name}
                      </CardTitle>
                      <CardDescription className="text-xs">{agent.description}</CardDescription>
                    </div>
                    {agent.isPublic && <Badge variant="default" className="text-xs">Public</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {tasks.length} tasks
                    </Badge>
                    {agent.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                    {agent.variables.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {agent.variables.length} variables
                      </Badge>
                    )}
                    {agent.tools && agent.tools.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {agent.tools.length} tools
                      </Badge>
                    )}
                    {agent.rules && agent.rules.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {agent.rules.length} rules
                      </Badge>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => onUseAgent(agent)}
                    className="w-full"
                  >
                    Use Agent
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}



function AgentFormContent({ 
  agent, 
  onChange, 
  previewElementRef,
  onCompile,
}: { 
  agent: PromptTemplate; 
  onChange: (data: PromptFormData) => void; 
  previewElementRef: React.RefObject<HTMLDivElement | null>;
  onCompile: (formData: Record<string, any>) => Promise<void>;
}) {  
  const fieldConfigs = agent.variables.map(variable => ({
    name: variable.name,
    type: variable.type === "boolean" ? "switch" : 
          variable.type === "number" ? "number" : 
          variable.type === "array" ? "textarea" : "text",
    label: variable.name,
    placeholder: variable.default || `Enter ${variable.name}`,
    description: variable.description || variable.instructions,
    required: variable.required,
  }));

  const defaultValues = agent.variables.reduce((acc, variable) => {
    if (variable.default) {
      if (variable.type === "number") {
        acc[variable.name] = parseFloat(variable.default) || 0;
      } else if (variable.type === "boolean") {
        acc[variable.name] = variable.default.toLowerCase() === "true";
      } else if (variable.type === "array") {
        try {
          acc[variable.name] = JSON.parse(variable.default);
        } catch {
          acc[variable.name] = variable.default.split(",").map(s => s.trim());
        }
      } else {
        acc[variable.name] = variable.default;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const { Form } = useFormedible({
    fields: fieldConfigs,
    submitLabel: "", // No submit button
    formOptions: {
      defaultValues,
      onSubmit: async () => {
        // No submit action, just onChange
      },
      onChange: async ({ value }) => {
        onChange(value);
        await onCompile(value);
      }
    }
  });

  useEffect(() => {
    if (previewElementRef.current) {
      previewElementRef.current.textContent = agent.prompt;
    }
  }, [agent.prompt, previewElementRef]);

  return (
    <div className="md:flex md:space-x-4">
      <div className="md:w-1/2 border rounded-lg p-4">
        {agent.variables.length === 0 ? (
          <div className="text-center">
            <p className="text-muted-foreground">
              This agent has no variables defined. The agent will be applied as-is.
            </p>
          </div>
        ) : (
          <>
            <Label className="text-sm font-medium mb-4 block">Agent Configuration</Label>
            <Form />
          </>
        )}
      </div>

      <div className="md:w-1/2 border rounded-lg p-4">
        <Label className="text-sm font-medium">System Prompt Preview</Label>
        <div 
          ref={previewElementRef}
          className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto"
        />
      </div>
    </div>
  );
}

function TaskFormContent({ 
  task, 
  onChange, 
  previewElementRef,
  onCompile,
}: { 
  task: PromptTemplate; 
  onChange: (data: PromptFormData) => void; 
  previewElementRef: React.RefObject<HTMLDivElement | null>;
  onCompile: (formData: Record<string, any>) => Promise<void>;
}) {  
  const fieldConfigs = task.variables.map(variable => ({
    name: variable.name,
    type: variable.type === "boolean" ? "switch" : 
          variable.type === "number" ? "number" : 
          variable.type === "array" ? "textarea" : "text",
    label: variable.name,
    placeholder: variable.default || `Enter ${variable.name}`,
    description: variable.description || variable.instructions,
    required: variable.required,
  }));

  const defaultValues = task.variables.reduce((acc, variable) => {
    if (variable.default) {
      if (variable.type === "number") {
        acc[variable.name] = parseFloat(variable.default) || 0;
      } else if (variable.type === "boolean") {
        acc[variable.name] = variable.default.toLowerCase() === "true";
      } else if (variable.type === "array") {
        try {
          acc[variable.name] = JSON.parse(variable.default);
        } catch {
          acc[variable.name] = variable.default.split(",").map(s => s.trim());
        }
      } else {
        acc[variable.name] = variable.default;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const { Form } = useFormedible({
    fields: fieldConfigs,
    submitLabel: "", // No submit button
    formOptions: {
      defaultValues,
      onSubmit: async () => {
        // No submit action, just onChange
      },
      onChange: async ({ value }) => {
        onChange(value);
        await onCompile(value);
      }
    }
  });

  useEffect(() => {
    if (previewElementRef.current) {
      previewElementRef.current.textContent = task.prompt;
    }
  }, [task.prompt, previewElementRef]);

  return (
    <div className="md:flex md:space-x-4">
      <div className="md:w-1/2 border rounded-lg p-4">
        {task.variables.length === 0 ? (
          <div className="text-center">
            <p className="text-muted-foreground">
              This task has no variables defined. The task will be executed as-is.
            </p>
          </div>
        ) : (
          <>
            <Label className="text-sm font-medium mb-4 block">Task Configuration</Label>
            <Form />
          </>
        )}
      </div>

      <div className="md:w-1/2 border rounded-lg p-4">
        <Label className="text-sm font-medium">Task Prompt Preview</Label>
        <div 
          ref={previewElementRef}
          className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto"
        />
      </div>
    </div>
  );
}

// Combined Agent + Task Form
function AgentTaskForm({ 
  agent, 
  tasks,
  onSubmit, 
  onBack,
  previewElementRef,
  onCompile,
  autoClearEnabled,
  onAutoClearChange,
  module
}: { 
  agent: PromptTemplate; 
  tasks: PromptTemplate[];
  onSubmit: (agentData: PromptFormData, selectedTask?: PromptTemplate, taskData?: PromptFormData) => void; 
  onBack: () => void; 
  previewElementRef: React.RefObject<HTMLDivElement | null>;
  onCompile: (formData: Record<string, any>) => Promise<void>;
  autoClearEnabled: boolean;
  onAutoClearChange: (enabled: boolean) => void;
  module: AgentControlModule;
}) {  
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [agentData, setAgentData] = useState<PromptFormData>({});
  const [taskData, setTaskData] = useState<PromptFormData>({});
  const taskPreviewElementRef = useRef<HTMLDivElement | null>(null);
  
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleAgentFormChange = (data: PromptFormData) => {
    setAgentData(data);
  };

  const handleTaskFormChange = (data: PromptFormData) => {
    setTaskData(data);
  };

  const handleTaskSelect = (taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskData({}); // Reset task form data when task changes
  };

  const handleSubmit = () => {
    if (selectedTask) {
      onSubmit(agentData, selectedTask, taskData);
    } else {
      onSubmit(agentData);
    }
  };

  const updateAgentPreview = async (formData: Record<string, any>) => {
    if (!previewElementRef.current) return;
    
    try {
      await onCompile(formData);
      // onCompile should handle updating the preview
    } catch (error) {
      if (previewElementRef.current) {
        previewElementRef.current.textContent = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
      }
    }
  };

  const updateTaskPreview = async (formData: Record<string, any>) => {
    if (!selectedTask || !taskPreviewElementRef.current) return;
    
    try {
      const compiled = await module.compileTaskTemplate(selectedTask.id, formData);
      taskPreviewElementRef.current.textContent = compiled.content;
    } catch (error) {
      taskPreviewElementRef.current.textContent = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Agents
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Label htmlFor="auto-clear" className="text-sm">Auto-clear after use</Label>
          <Switch
            id="auto-clear"
            checked={autoClearEnabled}
            onCheckedChange={onAutoClearChange}
          />
        </div>
      </div>

      {/* Task Selection */}
      {tasks.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">Task Selection (Optional)</CardTitle>
            <CardDescription>Choose a task to execute with this agent, or leave empty to use the agent alone.</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="task-select">Select Task</Label>
              <div className="flex gap-2">
                <Select value={selectedTaskId} onValueChange={handleTaskSelect}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a task (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedTaskId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedTaskId("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex-1 overflow-auto space-y-4">
        {/* Agent Form - Always visible */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Configuration</CardTitle>
            <CardDescription>Configure the system prompt and settings for {agent.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <AgentFormContent
              agent={agent}
              onChange={handleAgentFormChange}
              previewElementRef={previewElementRef}
              onCompile={updateAgentPreview}
            />
          </CardContent>
        </Card>

        {/* Task Form - Only visible when task is selected */}
        {selectedTask && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Configuration</CardTitle>
              <CardDescription>Configure the task prompt for {selectedTask.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <TaskFormContent
                task={selectedTask}
                onChange={handleTaskFormChange}
                previewElementRef={taskPreviewElementRef}
                onCompile={updateTaskPreview}
              />
            </CardContent>
          </Card>
        )}

        {/* Use Agent Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSubmit} size="lg">
            Use Agent {selectedTask ? `with ${selectedTask.name}` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const AgentControl: React.FC<AgentControlProps> = ({ module }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<PromptTemplate | null>(null);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [updateCounter, setUpdateCounter] = useState(0);
  const previewElementRef = useRef<HTMLDivElement | null>(null);

  // Set up component update notifications
  useEffect(() => {
    const notifyCallback = () => {
      setUpdateCounter(prev => prev + 1);
    };
    
    module.setNotifyCallback(notifyCallback);
    
    return () => {
      module.setNotifyCallback(null);
    };
  }, [module]);

  useEffect(() => {
    if (isModalOpen) {
      module.loadPromptTemplates();
    }
  }, [isModalOpen, module]);

  // Get data from module instead of store
  const agents = module.getAgents();
  
  // Get current agent state - this will re-evaluate when updateCounter changes
  const hasActiveAgent = module.hasActiveAgent();
  const currentAgentId = module.getCurrentAgentId();
  const currentAgent = currentAgentId ? agents.find(a => a.id === currentAgentId) : null;

  // Force re-evaluation when updateCounter changes
  useEffect(() => {
    // This effect ensures the component re-renders when the module state changes
  }, [updateCounter]);

  const handleUseAgent = (agent: PromptTemplate) => {
    setSelectedAgent(agent);
    setShowAgentForm(true);
  };

  const handleAgentFormSubmit = async (
    agentData: PromptFormData, 
    selectedTask?: PromptTemplate, 
    taskData?: PromptFormData
  ) => {
    if (!selectedAgent) return;

    try {
      if (selectedTask && taskData) {
        await module.applyAgentWithTask(selectedAgent.id, selectedTask.id, agentData, taskData);
        toast.success(`Agent "${selectedAgent.name}" applied with task "${selectedTask.name}"!`);
      } else {
        await module.applyAgent(selectedAgent.id, agentData);
        toast.success(`Agent "${selectedAgent.name}" applied!`);
      }
      
      if (module.getAutoClearEnabled()) {
        module.clearOnSubmit?.();
      }
      
      setIsModalOpen(false);
      setSelectedAgent(null);
      setShowAgentForm(false);
    } catch (error) {
      console.error("Failed to apply agent:", error);
      toast.error("Failed to apply agent!");
    }
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setShowAgentForm(false);
  };

  const handleClearAgent = () => {
    module.clearOnSubmit?.();
    toast.success("Agent cleared!");
  };

  const updatePreview = async (formData: Record<string, any>) => {
    if (!selectedAgent || !previewElementRef.current) return;
    
    try {
      const compiled = await module.compileTemplate(selectedAgent.id, formData);
      previewElementRef.current.textContent = compiled.content;
    } catch (error) {
      previewElementRef.current.textContent = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
    }
  };

  const getDialogTitle = () => {
    if (showAgentForm && selectedAgent) return `Configure ${selectedAgent.name}`;
    return "Select Agent";
  };

  const getDialogDescription = () => {
    if (showAgentForm && selectedAgent) return "Configure the agent and optionally select a task to execute.";
    return "Select an AI agent to work with. Each agent has specialized capabilities and tasks.";
  };

  return (
    <>
      <Button
        variant={hasActiveAgent ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="h-8 w-8 p-0"
        title={hasActiveAgent ? `Active Agent: ${currentAgent?.name || 'Unknown'}` : "Select Agent"}
      >
        <LiteChatIcon className="h-4 w-4" />
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!w-[80vw] !h-[85vh] !max-w-none flex flex-col">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {showAgentForm && selectedAgent ? (
              <AgentTaskForm
                agent={selectedAgent}
                tasks={module.getTasksForAgent(selectedAgent.id)}
                onSubmit={handleAgentFormSubmit}
                onBack={handleBackToAgents}
                previewElementRef={previewElementRef}
                onCompile={updatePreview}
                autoClearEnabled={module.getAutoClearEnabled()}
                onAutoClearChange={module.setAutoClearEnabled}
                module={module}
              />
            ) : (
              <AgentSelector
                agents={agents}
                onUseAgent={handleUseAgent}
                onClearAgent={handleClearAgent}
                hasActiveAgent={hasActiveAgent}
                currentAgentName={currentAgent?.name}
                module={module}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 