import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import type { PromptTemplate } from "@/types/litechat/prompt-template";

interface TemplateListProps {
  templates: PromptTemplate[];
  onEdit: (template: PromptTemplate) => void;
  onDelete: (id: string) => void;
  type: "prompt" | "agent" | "task";
  emptyMessage?: string;
  additionalActions?: (template: PromptTemplate) => React.ReactNode;
  getTaskCount?: (agentId: string) => number;
}

export const TemplateList: React.FC<TemplateListProps> = ({
  templates,
  onEdit,
  onDelete,
  type,
  emptyMessage,
  additionalActions,
  getTaskCount,
}) => {
  const getTypeLabel = () => {
    switch (type) {
      case "agent": return "Agents";
      case "task": return "Tasks";
      default: return "Templates";
    }
  };

  const getTypeDescription = () => {
    switch (type) {
      case "agent": return "Manage your AI agents and their associated tasks";
      case "task": return "Manage tasks for this agent";
      default: return "Manage your reusable prompt templates with dynamic variables";
    }
  };

  const getEmptyMessage = () => {
    if (emptyMessage) return emptyMessage;
    switch (type) {
      case "agent": return "No Agents Yet";
      case "task": return "No Tasks Yet";
      default: return "No Templates Yet";
    }
  };

  const getEmptyDescription = () => {
    switch (type) {
      case "agent": return 'Use the "New Agent" tab to create your first agent';
      case "task": return "Create tasks to define what this agent can do";
      default: return 'Use the "New Template" tab to create your first template';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{getTypeLabel()}</h3>
        <p className="text-sm text-muted-foreground">
          {getTypeDescription()}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <h4 className="font-medium text-muted-foreground">
            {getEmptyMessage()}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            {getEmptyDescription()}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Variables</TableHead>
              {type === "agent" && <TableHead>Tasks</TableHead>}
              {(type === "prompt" || type === "task") && <TableHead>Follow-ups</TableHead>}
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
                {type === "agent" && (
                  <TableCell>
                    <Badge variant="secondary">
                      {getTaskCount ? getTaskCount(template.id) : 0}
                    </Badge>
                  </TableCell>
                )}
                {(type === "prompt" || type === "task") && (
                  <TableCell>
                    <Badge variant="secondary">
                      {template.followUps?.length || 0}
                    </Badge>
                  </TableCell>
                )}
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
                    {additionalActions && additionalActions(template)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(template)}
                      title={`Edit ${type}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(template.id)}
                      title={`Delete ${type}`}
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
}; 