// src/components/LiteChat/settings/tags/TagForm.tsx
// FULL FILE
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import type { DbTag } from "@/types/litechat/rules";
import { toast } from "sonner";

interface TagFormProps {
  initialData?: Partial<DbTag>;
  isSaving: boolean;
  onSave: (
    data: Omit<DbTag, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string | void>;
  onCancel: () => void;
}

export const TagForm: React.FC<TagFormProps> = ({
  initialData,
  isSaving,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );

  useEffect(() => {
    setName(initialData?.name || "");
    setDescription(initialData?.description || "");
  }, [initialData]);

  const handleSaveClick = useCallback(async () => {
    if (!name.trim()) {
      toast.error("Tag Name is required.");
      return;
    }
    await onSave({
      name: name.trim(),
      description: description?.trim() || null,
    });
  }, [name, description, onSave]);

  return (
    <div className="space-y-4 border rounded-md p-4 bg-card shadow-md">
      <h4 className="font-semibold text-card-foreground">
        {initialData?.id ? "Edit Tag" : "Add New Tag"}
      </h4>
      <div className="space-y-1.5">
        <Label htmlFor="tag-name">Tag Name</Label>
        <Input
          id="tag-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Code Generation, Summarization"
          required
          disabled={isSaving}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tag-description">Description (Optional)</Label>
        <Textarea
          id="tag-description"
          value={description || ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe when to use this tag..."
          rows={2}
          disabled={isSaving}
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
          disabled={isSaving || !name.trim()}
          type="button"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save Tag"}
        </Button>
      </div>
    </div>
  );
};
