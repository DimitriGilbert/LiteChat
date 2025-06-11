import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookOpenText } from "lucide-react";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useShallow } from "zustand/react/shallow";

import { toast } from "sonner";
// Forward declare the module type to avoid circular import issues
interface PromptLibraryControlModule {
  compileTemplate: (templateId: string, formData: Record<string, any>) => Promise<{ content: string; selectedTools?: string[]; selectedRules?: string[]; }>;
  applyTemplate: (templateId: string, formData: PromptFormData) => Promise<void>;
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

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="search">Search Templates</Label>
        <Input
          id="search"
          placeholder="Search by name, description, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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
  onBack 
}: { 
  template: PromptTemplate; 
  onSubmit: (data: PromptFormData) => void; 
  onBack: () => void; 
}) {
  // Debug: Log template variables
  console.log('PromptTemplateForm - template.variables:', template.variables);
  console.log('PromptTemplateForm - template.prompt:', template.prompt);
  
  // Create field configs from template variables
  const fieldConfigs = template.variables.map(variable => ({
    name: variable.name,
    type: variable.type === "boolean" ? "switch" : 
          variable.type === "number" ? "number" : 
          variable.type === "array" ? "textarea" : "text",
    label: variable.name,
    placeholder: variable.default || `Enter ${variable.name}`,
    description: variable.description || variable.instructions,
    required: variable.required,
  }));

  console.log('PromptTemplateForm - fieldConfigs:', fieldConfigs);

  const defaultValues = template.variables.reduce((acc, variable) => {
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
    submitLabel: "Apply Template",
    formOptions: {
      defaultValues,
      onSubmit: async ({ value }) => {
        console.log('Form submitted with value:', value);
        onSubmit(value);
      }
    }
  });

  console.log('useFormedible result:', { Form });

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

      <div className="border rounded-lg p-4">
        <Label className="text-sm font-medium">Template Preview</Label>
        <div className="mt-2 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap">
          {template.prompt}
        </div>
      </div>

      {template.variables.length === 0 ? (
        <div className="border rounded-lg p-4 text-center">
          <p className="text-muted-foreground">
            This template has no variables defined. The template will be applied as-is.
          </p>
          <Button onClick={() => onSubmit({})} className="mt-3">
            Apply Template
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <Label className="text-sm font-medium mb-4 block">Template Variables</Label>
          <Form />
        </div>
      )}
    </div>
  );
}

export const PromptLibraryControl: React.FC<PromptLibraryControlProps> = ({ module }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);

  const { promptTemplates, loadPromptTemplates } = usePromptTemplateStore(
    useShallow((state) => ({
      promptTemplates: state.promptTemplates,
      loadPromptTemplates: state.loadPromptTemplates,
    }))
  );

  // We'll need to access the inputAreaRef from the parent to set the value

  useEffect(() => {
    if (isModalOpen) {
      loadPromptTemplates();
    }
  }, [isModalOpen, loadPromptTemplates]);

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
  };

  const handleFormSubmit = async (formData: PromptFormData) => {
    if (!selectedTemplate) return;

    console.log('handleFormSubmit called with:', formData);
    console.log('selectedTemplate:', selectedTemplate);

    try {
      // Apply the template to the input area
      console.log('Calling module.applyTemplate...');
      await module.applyTemplate(selectedTemplate.id, formData);
      
      console.log('Template applied successfully, closing modal...');
      setIsModalOpen(false);
      setSelectedTemplate(null);
      toast.success("Template applied to input area!");
    } catch (error) {
      console.error("Failed to apply template:", error);
      toast.error("Failed to apply template");
    }
  };

  const handleBack = () => {
    setSelectedTemplate(null);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className="h-8 w-8 p-0"
        title="Open Prompt Library"
      >
        <BookOpenText className="h-4 w-4" />
      </Button>

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
              />
            ) : (
              <PromptTemplateSelector
                templates={promptTemplates}
                onSelect={handleTemplateSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}; 