import React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation('assistantSettings');
  
  const getTypeLabel = () => {
    switch (type) {
      case "agent": return t('templateList.agents');
      case "task": return t('templateList.tasks');
      default: return t('templateList.templates');
    }
  };

  const getTypeDescription = () => {
    switch (type) {
      case "agent": return t('templateList.agentsDescription');
      case "task": return t('templateList.tasksDescription');
      default: return t('templateList.templatesDescription');
    }
  };

  const getEmptyMessage = () => {
    if (emptyMessage) return emptyMessage;
    switch (type) {
      case "agent": return t('templateList.noAgents');
      case "task": return t('templateList.noTasks');
      default: return t('templateList.noTemplates');
    }
  };

  const getEmptyDescription = () => {
    switch (type) {
      case "agent": return t('templateList.noAgentsDescription');
      case "task": return t('templateList.noTasksDescription');
      default: return t('templateList.noTemplatesDescription');
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
              <TableHead>{t('templateList.nameColumn')}</TableHead>
              <TableHead>{t('templateList.descriptionColumn')}</TableHead>
              <TableHead>{t('templateList.variablesColumn')}</TableHead>
              {type === "agent" && <TableHead>{t('templateList.tasksColumn')}</TableHead>}
              {(type === "prompt" || type === "task") && <TableHead>{t('templateList.followUpsColumn')}</TableHead>}
              <TableHead>{t('templateList.toolsColumn')}</TableHead>
              <TableHead>{t('templateList.rulesTagsColumn')}</TableHead>
              <TableHead className="text-right">{t('templateList.actionsColumn')}</TableHead>
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
                      {template.tags?.length || 0} {t('templateList.tags')}
                    </Badge>
                    <Badge variant="secondary">
                      {template.rules?.length || 0} {t('templateList.rules')}
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
                      title={t('templateList.editTitle', { type })}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(template.id)}
                      title={t('templateList.deleteTitle', { type })}
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