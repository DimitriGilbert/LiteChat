import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X } from "lucide-react";
import type { PromptVariable } from "@/types/litechat/prompt-template";

interface VariableManagerProps {
  variables: PromptVariable[];
  onVariablesChange: (variables: PromptVariable[]) => void;
  templateId?: string;
}

export const VariableManager: React.FC<VariableManagerProps> = ({
  variables,
  onVariablesChange,
  templateId,
}) => {
  const [newVariable, setNewVariable] = useState<PromptVariable>({
    name: "",
    description: "",
    type: "string",
    required: false,
    default: "",
    instructions: "",
  });

  // Reset newVariable state when template changes
  useEffect(() => {
    setNewVariable({
      name: "",
      description: "",
      type: "string",
      required: false,
      default: "",
      instructions: "",
    });
  }, [templateId]);

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
    };
  }, []);

  const addVariable = () => {
    if (newVariable.name) {
      onVariablesChange([...variables, { ...newVariable }]);
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
    onVariablesChange(variables.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium">Variables</Label>
        <div className="space-y-3 mt-2">
          {variables.map((variable, index) => (
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
                  key={`new-variable-type-${templateId || 'new'}`}
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
  );
}; 