import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BookOpenText, Settings, Edit } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { parseVariableValue } from "@/lib/litechat/prompt-util";

import { toast } from "sonner";
// Forward declare the module type to avoid circular import issues
interface PromptLibraryControlModule {
  compileTemplate: (templateId: string, formData: Record<string, any>) => Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }>;
  applyTemplate: (templateId: string, formData: PromptFormData) => Promise<void>;
  getShortcutTemplates: () => PromptTemplate[];
}
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

interface PromptLibraryControlProps {
  module: PromptLibraryControlModule;
}

function PromptTemplateSelector({ 
  templates, 
  onSelect 
}: { 
  templates: PromptTemplate[]; 
  onSelect: (template: PromptTemplate) => void; 
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenTemplateSettings = () => {
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "settingsModal",
      initialTab: "assistant",
      initialSubTab: "prompts",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex-grow">
          <Label htmlFor="search">Search Templates</Label>
          <Input
            id="search"
            placeholder="Search by name, description, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTemplateSettings}
            className="h-9 px-3"
            title="Open Template Settings"
          >
            <Settings className="h-4 w-4 mr-1" />
            Manage
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No templates match your search." : "No templates available."}
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <Card 
              key={template.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </div>
                  {template.isPublic && <Badge variant="default" className="text-xs">Public</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  {template.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                  {template.variables.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {template.variables.length} variables
                    </Badge>
                  )}
                  {template.tools && template.tools.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {template.tools.length} tools
                    </Badge>
                  )}
                  {template.rules && template.rules.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {template.rules.length} rules
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

function PromptTemplateForm({ 
  template, 
  onSubmit, 
  onBack,
  previewElementRef,
  onCompile,
}: { 
  template: PromptTemplate; 
  onSubmit: (data: PromptFormData) => void; 
  onBack: () => void; 
  module: PromptLibraryControlModule;
  previewElementRef: React.RefObject<HTMLDivElement | null>;
  onCompile: (formData: Record<string, any>) => Promise<void>;
}) {  
  // Create field configs from template variables
  const fieldConfigs = template.variables.map(variable => ({
    name: variable.name,
    type: variable.type === "boolean" ? "switch" : 
          variable.type === "number" ? "number" : 
          variable.type === "array" ? "textarea" : "text",
    label: variable.name,
    placeholder: variable.default != null ? String(variable.default) : `Enter ${variable.name}`,
    description: variable.description || variable.instructions,
    required: variable.required,
  }));

  const defaultValues = template.variables.reduce((acc, variable) => {
    if (variable.default !== undefined) {
      acc[variable.name] = parseVariableValue(variable.default, variable.type);
    }
    return acc;
  }, {} as Record<string, any>);

  const { Form } = useFormedible({
    fields: fieldConfigs,
    submitLabel: "Proompt !",
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
          ← Back
        </Button>
        <div>
          <h3 className="font-medium">{template.name}</h3>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>
      </div>

      <div className="md:flex md:space-x-4">
        <div className="md:w-1/2 border rounded-lg p-4">
          {template.variables.length === 0 ? (
            <div className="text-center">
              <p className="text-muted-foreground">
                This template has no variables defined. The template will be applied as-is.
              </p>
              <Button onClick={() => onSubmit({})} className="mt-3">
                Proompt !
              </Button>
            </div>
          ) : (
            <>
              <Label className="text-sm font-medium mb-4 block">Template Variables</Label>
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
            {template.prompt}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PromptLibraryControl: React.FC<PromptLibraryControlProps> = ({ module }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  
  // Use ref for preview DOM element - direct manipulation, no re-renders
  const previewElementRef = useRef<HTMLDivElement | null>(null);

  const { loadPromptTemplates, getTemplatesByType } = usePromptTemplateStore(
    useShallow((state) => ({
      loadPromptTemplates: state.loadPromptTemplates,
      getTemplatesByType: state.getTemplatesByType,
    }))
  );

  // Filter to only show prompt type templates (not agents or tasks)
  const promptTypeTemplates = getTemplatesByType("prompt");

  useEffect(() => {
    if (isModalOpen) {
      loadPromptTemplates();
    }
  }, [isModalOpen, loadPromptTemplates]);

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    // Initialize preview directly in DOM
    if (previewElementRef.current) {
      previewElementRef.current.textContent = template.prompt;
    }
  };

  const handleFormSubmit = async (formData: PromptFormData) => {
    if (!selectedTemplate) return;

    try {
      // Apply the template to the input area
      await module.applyTemplate(selectedTemplate.id, formData);
      
      setIsModalOpen(false);
      setSelectedTemplate(null);
      toast.success("Template applied to input area!");
    } catch (error) {
      console.error("Failed to Proompt :", error);
      toast.error("Failed to Proompt !");
    }
  };

  const handleBack = () => {
    setSelectedTemplate(null);
  };

  // Update preview directly in DOM - NO REACT RE-RENDERS
  const updatePreview = async (formData: Record<string, any>) => {
    if (!selectedTemplate || !previewElementRef.current) return;
    
    try {
      const compiled = await module.compileTemplate(selectedTemplate.id, formData);
      previewElementRef.current.textContent = compiled.content;
    } catch (error) {
      previewElementRef.current.textContent = `Error: ${error instanceof Error ? error.message : 'Compilation failed'}`;
    }
  };

  const shortcutTemplates = module.getShortcutTemplates();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter templates based on search term
  const filteredTemplates = shortcutTemplates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRunShortcutTemplate = (template: PromptTemplate) => {
    // Check if template needs configuration (has variables)
    if (template.variables && template.variables.length > 0) {
      // Open template configuration
      handleTemplateSelect(template);
      setIsModalOpen(true);
    } else {
      // Apply template directly
      module.applyTemplate(template.id, {}).then(() => {
        toast.success(`Template "${template.name}" applied!`);
      }).catch((error) => {
        console.error("Failed to apply template:", error);
        toast.error("Failed to apply template!");
      });
    }
  };

  return (
    <>
      {shortcutTemplates.length > 0 ? (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="h-8 w-8 p-0"
              title="Open Prompt Library"
            >
              <BookOpenText className="h-4 w-4" />
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-80 p-0" align="start">
            <div className="p-3 border-b">
              <h4 className="font-semibold text-sm mb-2">Quick Templates</h4>
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    {searchTerm ? "No templates match your search" : "No shortcut templates available"}
                  </div>
                ) : (
                  filteredTemplates.map((template) => {
                    const needsConfig = template.variables && template.variables.length > 0;
                    
                    return (
                      <div
                        key={template.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors group"
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateSelect(template);
                            setIsModalOpen(true);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handleRunShortcutTemplate(template)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{template.name}</span>
                            {template.variables && template.variables.length > 0 && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {template.variables.length}
                              </Badge>
                            )}
                            {needsConfig && (
                              <Badge variant="secondary" className="text-xs px-1 py-0">
                                Setup
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {template.description}
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          className="h-8 w-8 p-0"
          title="Open Prompt Library"
        >
          <BookOpenText className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!w-[80vw] !h-[85vh] !max-w-none flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Fill Template Variables" : "Prompt Library"}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate 
                ? "Provide values for the template variables below." 
                : "Select a prompt template to use. Templates can include dynamic variables, auto-select tools, and rules."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            {selectedTemplate ? (
              <PromptTemplateForm
                template={selectedTemplate}
                onSubmit={handleFormSubmit}
                onBack={handleBack}
                module={module}
                previewElementRef={previewElementRef}
                onCompile={updatePreview}
              />
            ) : (
              <PromptTemplateSelector
                templates={promptTypeTemplates}
                onSelect={handleTemplateSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 