import React, { useEffect, useState } from "react";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Edit, Plus } from "lucide-react";
import type { PromptTemplate } from "@/types/litechat/prompt-template";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { TemplateFormBase, BaseTemplateFormData } from "./common/TemplateFormBase";
import { TemplateList } from "./common/TemplateList";

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

  const handleCreateAgent = async (data: BaseTemplateFormData) => {
    await addPromptTemplate({
      ...data,
      type: "agent",
      isPublic: false,
      isShortcut: data.isShortcut || false,
    });
  };

  const handleUpdateAgent = async (data: BaseTemplateFormData) => {
    if (!editingAgent) return;
    await updatePromptTemplate(editingAgent.id, {
      ...data,
      isShortcut: data.isShortcut || false,
    });
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

  const handleCreateTask = async (data: BaseTemplateFormData) => {
    if (!managingAgent) return;
    await addPromptTemplate({
      ...data,
      type: "task",
      parentId: managingAgent.id,
      isPublic: false,
      isShortcut: data.isShortcut || false,
    });
  };

  const handleUpdateTask = async (data: BaseTemplateFormData) => {
    if (!editingTask || !managingAgent) return;
    await updatePromptTemplate(editingTask.id, {
      ...data,
      parentId: managingAgent.id,
      isShortcut: data.isShortcut || false,
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
        <TemplateList
          templates={agents}
          onEdit={handleEditAgent}
          onDelete={handleDeleteAgent}
          type="agent"
          getTaskCount={(agentId) => getTasksForAgent(agentId).length}
          additionalActions={(agent) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleManageTasks(agent)}
              title="Manage Tasks"
            >
              <Edit className="h-4 w-4" />
              Tasks
            </Button>
          )}
        />
      ),
    },
    {
      value: "new-agent",
      label: "New Agent",
      content: (
        <TemplateFormBase
          key="new-agent-form"
          onSubmit={handleCreateAgent}
          onSuccess={handleFormSuccess}
          type="agent"
          showFollowUps={false} // Agents don't have follow-ups
          showMaxSteps={true}
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
        <TemplateFormBase
          key={`edit-agent-form-${editingAgent.id}`}
          template={editingAgent}
          onSubmit={handleUpdateAgent}
          onSuccess={handleFormSuccess}
          type="agent"
          showFollowUps={false} // Agents don't have follow-ups
          showMaxSteps={true}
          additionalActions={
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleManageTasks(editingAgent)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Tasks ({getTasksForAgent(editingAgent.id).length})
            </Button>
          }
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Tasks for {managingAgent.name}</h3>
              <p className="text-sm text-muted-foreground">
                Manage tasks for this agent
              </p>
            </div>
            <Button onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </div>
          <TemplateList
            templates={managingAgentTasks}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
            type="task"
            emptyMessage="No Tasks Yet"
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
          <TemplateFormBase
            key={`new-task-form-${managingAgent.id}`}
            onSubmit={handleCreateTask}
            onSuccess={handleBackToTasks}
            type="task"
            showFollowUps={true} // Tasks can have follow-ups to other tasks
            followUpOptions={managingAgentTasks} // Only other tasks from same agent
            showMaxSteps={true}
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
          <TemplateFormBase
            key={`edit-task-form-${editingTask.id}`}
            template={editingTask}
            onSubmit={handleUpdateTask}
            onSuccess={handleBackToTasks}
            type="task"
            showFollowUps={true} // Tasks can have follow-ups to other tasks
            followUpOptions={managingAgentTasks.filter(t => t.id !== editingTask.id)} // Exclude self
            showMaxSteps={true}
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