// src/components/LiteChat/settings/SettingsProviderRowView.tsx
import React from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider"; // Correct path
import { Button } from "@/components/ui/button";

type FetchStatus = "idle" | "fetching" | "error" | "success";

interface ProviderRowViewModeProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onFetchModels: () => Promise<void>;
  fetchStatus: FetchStatus;
  isDeleting: boolean;
  getAllAvailableModelDefs: () => { id: string; name: string }[];
}

export const ProviderRowViewMode: React.FC<ProviderRowViewModeProps> = ({
  provider,
  onEdit,
  onDelete,
  isDeleting,
}) => {
  // Placeholder implementation
  return (
    <div className="flex justify-between items-center p-2 border rounded mb-2 bg-card">
      <div>
        <p className="font-semibold">{provider.name}</p>
        <p className="text-xs text-muted-foreground">Type: {provider.type}</p>
        <p className="text-xs text-muted-foreground">
          Enabled: {provider.isEnabled ? "Yes" : "No"}
        </p>
        <p className="text-xs text-red-500">(Placeholder View)</p>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isDeleting}
        >
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
  );
};
