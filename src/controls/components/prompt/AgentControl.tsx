import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useShallow } from "zustand/react/shallow";
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
import { useFormedible } from "@/hooks/use-formedible";
import type { PromptTemplate, PromptFormData } from "@/types/litechat/prompt-template";

// Forward declare the module type to avoid circular import issues
interface AgentControlModule {
  compileTemplate: (templateId: string, formData: PromptFormData) => Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }>;
  applyTemplate: (templateId: string, formData: PromptFormData) => Promise<void>;
}

interface AgentControlProps {
  module: AgentControlModule;
}

function AgentSelector({ 
  agents, 
  onSelect 
}: { 
  agents: PromptTemplate[]; 
  onSelect: (agent: PromptTemplate) => void; 
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const { getTasksForAgent } = usePromptTemplateStore(
    useShallow((state) => ({
      getTasksForAgent: state.getTasksForAgent,
    }))
  );

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
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
            const tasks = getTasksForAgent(agent.id);
            return (
              <Card 
                key={agent.id} 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(agent)}
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
                <CardContent className="pt-0">
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
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function TaskSelector({ 
  agent,
  tasks, 
  onSelect,
  onBack
}: { 
  agent: PromptTemplate;
  tasks: PromptTemplate[]; 
  onSelect: (task: PromptTemplate) => void; 
  onBack: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTasks = tasks.filter(task =>
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back to Agents
        </Button>
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {agent.name} Tasks
          </h3>
          <p className="text-sm text-muted-foreground">Select a task to execute</p>
        </div>
      </div>

      <div>
        <Label htmlFor="search">Search Tasks</Label>
        <Input
          id="search"
          placeholder="Search by name, description, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No tasks match your search." : "This agent has no tasks yet."}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <Card 
              key={task.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(task)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{task.name}</CardTitle>
                    <CardDescription className="text-xs">{task.description}</CardDescription>
                  </div>
                  {task.isPublic && <Badge variant="default" className="text-xs">Public</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  {task.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                  {task.variables.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {task.variables.length} variables
                    </Badge>
                  )}
                  {task.tools && task.tools.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {task.tools.length} tools
                    </Badge>
                  )}
                  {task.rules && task.rules.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {task.rules.length} rules
                    </Badge>
                  )}
                  {task.followUps && task.followUps.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {task.followUps.length} follow-ups
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function TaskForm({ 
  task, 
  onSubmit, 
  onBack,
  previewElementRef,
  onCompile,
}: { 
  task: PromptTemplate; 
  onSubmit: (data: PromptFormData) => void; 
  onBack: () => void; 
  previewElementRef: React.RefObject<HTMLDivElement | null>;
  onCompile: (formData: Record<string, any>) => Promise<void>;
}) {  
  // Create field configs from task variables
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
    submitLabel: "Execute Task",
    formOptions: {
      defaultValues,
      onSubmit: async ({ value }) => {
        onSubmit(value);
      },
      onChange: async ({ value }) => {
        // This now only updates a ref, not state - no re-renders
        await onCompile(value);
      }
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Back to Tasks
        </Button>
        <div>
          <h3 className="font-medium">{task.name}</h3>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>
      </div>

      <div className="md:flex md:space-x-4">
        <div className="md:w-1/2 border rounded-lg p-4">
          {task.variables.length === 0 ? (
            <div className="text-center">
              <p className="text-muted-foreground">
                This task has no variables defined. The task will be executed as-is.
              </p>
              <Button onClick={() => onSubmit({})} className="mt-3">
                Execute Task
              </Button>
            </div>
          ) : (
            <>
              <Label className="text-sm font-medium mb-4 block">Task Variables</Label>
              <Form />
            </>
          )}
        </div>

        <div className="md:w-1/2 border rounded-lg p-4">
          <Label className="text-sm font-medium">Live Preview</Label>
          <div 
            ref={previewElementRef}
            className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto"
          >
            {task.prompt}
          </div>
        </div>
      </div>
    </div>
  );
}

export const AgentControl: React.FC<AgentControlProps> = ({ module }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<PromptTemplate | null>(null);
  const [selectedTask, setSelectedTask] = useState<PromptTemplate | null>(null);
  
  // Use ref for preview DOM element - direct manipulation, no re-renders
  const previewElementRef = useRef<HTMLDivElement | null>(null);

  const { 
    loadPromptTemplates, 
    getAgents, 
    getTasksForAgent 
  } = usePromptTemplateStore(
    useShallow((state) => ({
      loadPromptTemplates: state.loadPromptTemplates,
      getAgents: state.getAgents,
      getTasksForAgent: state.getTasksForAgent,
    }))
  );

  useEffect(() => {
    if (isModalOpen) {
      loadPromptTemplates();
    }
  }, [isModalOpen, loadPromptTemplates]);

  const agents = getAgents();
  const selectedAgentTasks = selectedAgent ? getTasksForAgent(selectedAgent.id) : [];

  const handleAgentSelect = (agent: PromptTemplate) => {
    setSelectedAgent(agent);
    setSelectedTask(null);
  };

  const handleTaskSelect = (task: PromptTemplate) => {
    setSelectedTask(task);
    // Initialize preview directly in DOM
    if (previewElementRef.current) {
      previewElementRef.current.textContent = task.prompt;
    }
  };

  const handleFormSubmit = async (formData: PromptFormData) => {
    if (!selectedTask) return;

    try {
      // Apply the task template to the input area
      await module.applyTemplate(selectedTask.id, formData);
      
      setIsModalOpen(false);
      setSelectedAgent(null);
      setSelectedTask(null);
      toast.success("Task applied to input area!");
    } catch (error) {
      console.error("Failed to execute task:", error);
      toast.error("Failed to execute task!");
    }
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setSelectedTask(null);
  };

  const handleBackToTasks = () => {
    setSelectedTask(null);
  };

  // Update preview directly in DOM - NO REACT RE-RENDERS
  const updatePreview = async (formData: Record<string, any>) => {
    if (!selectedTask || !previewElementRef.current) return;
    
    try {
      const compiled = await module.compileTemplate(selectedTask.id, formData);
      previewElementRef.current.textContent = compiled.content;
    } catch (error) {
      previewElementRef.current.textContent = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
    }
  };

  const getDialogTitle = () => {
    if (selectedTask) return "Execute Task";
    if (selectedAgent) return "Select Task";
    return "Select Agent";
  };

  const getDialogDescription = () => {
    if (selectedTask) return "Provide values for the task variables below.";
    if (selectedAgent) return "Choose a task to execute from this agent.";
    return "Select an AI agent to work with. Each agent has specialized tasks you can execute.";
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="h-8 w-8 p-0"
        title="Select Agent & Task"
      >
        <Bot className="h-4 w-4" />
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!w-[80vw] !h-[85vh] !max-w-none flex flex-col">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {selectedTask ? (
              <TaskForm
                task={selectedTask}
                onSubmit={handleFormSubmit}
                onBack={handleBackToTasks}
                previewElementRef={previewElementRef}
                onCompile={updatePreview}
              />
            ) : selectedAgent ? (
              <TaskSelector
                agent={selectedAgent}
                tasks={selectedAgentTasks}
                onSelect={handleTaskSelect}
                onBack={handleBackToAgents}
              />
            ) : (
              <AgentSelector
                agents={agents}
                onSelect={handleAgentSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 