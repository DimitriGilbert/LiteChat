// src/components/LiteChat/settings/add-provider-form.tsx
import React from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";

interface AddProviderFormProps {
  apiKeys: DbApiKey[];
  onAddProvider: (
    configData: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onCancel: () => void;
}

export const AddProviderForm: React.FC<AddProviderFormProps> = ({
  onCancel,
}) => {
  // Placeholder implementation
  return (
    <div className="border p-4 rounded bg-muted/50">
      <h4 className="font-bold mb-2">Add New Provider</h4>
      <p className="text-xs text-red-500 mb-2">
        (Placeholder Add Form Component)
      </p>
      {/* Add actual form fields and logic later */}
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
};
