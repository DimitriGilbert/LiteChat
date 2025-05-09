// src/components/LiteChat/settings/rules/RuleForm.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import type { DbRule, RuleType } from "@/types/litechat/rules";
import { toast } from "sonner";

interface RuleFormProps {
  initialData?: Partial<DbRule>;
  isSaving: boolean;
  onSave: (
    data: Omit<DbRule, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string | void>;
  onCancel: () => void;
}

export const RuleForm: React.FC<RuleFormProps> = ({
  initialData,
  isSaving,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [type, setType] = useState<RuleType>(initialData?.type || "before");

  useEffect(() => {
    setName(initialData?.name || "");
    setContent(initialData?.content || "");
    setType(initialData?.type || "before");
  }, [initialData]);

  const handleSaveClick = useCallback(async () => {
    if (!name.trim() || !content.trim()) {
      toast.error("Rule Name and Content are required.");
      return;
    }
    await onSave({ name: name.trim(), content: content.trim(), type });
  }, [name, content, type, onSave]);

  return (
    <div className="space-y-4 border rounded-md p-4 bg-card shadow-md">
      <h4 className="font-semibold text-card-foreground">
        {initialData?.id ? "Edit Rule" : "Add New Rule"}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="rule-name">Rule Name</Label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Always respond in JSON"
            required
            disabled={isSaving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-type">Rule Type</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as RuleType)}
            disabled={isSaving}
          >
            <SelectTrigger id="rule-type">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System Prompt</SelectItem>
              <SelectItem value="before">Before User Prompt</SelectItem>
              <SelectItem value="after">After User Prompt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rule-content">Rule Content</Label>
        <Textarea
          id="rule-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter the rule text to be injected..."
          required
          rows={4}
          disabled={isSaving}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSaveClick}
          disabled={isSaving || !name.trim() || !content.trim()}
          type="button"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save Rule"}
        </Button>
      </div>
    </div>
  );
};
