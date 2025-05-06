// src/components/LiteChat/settings/ProviderConfigForm.tsx
// NEW FILE
import React, { useCallback } from "react";
import type {
  DbProviderConfig,
  DbApiKey,
  DbProviderType,
} from "@/types/litechat/provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ApiKeySelector } from "@/components/LiteChat/settings/ApiKeySelector";
import {
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";

// Define the shape of the form data this component expects
export type ProviderFormData = Partial<
  Pick<
    DbProviderConfig,
    "name" | "type" | "isEnabled" | "apiKeyId" | "baseURL" | "autoFetchModels"
  >
>;

interface ProviderConfigFormProps {
  formData: ProviderFormData;
  onChange: (
    field: keyof ProviderFormData,
    value: string | boolean | null,
  ) => void;
  apiKeys: DbApiKey[];
  disabled?: boolean;
  className?: string;
}

export const ProviderConfigForm: React.FC<ProviderConfigFormProps> = ({
  formData,
  onChange,
  apiKeys,
  disabled = false,
  className,
}) => {
  const needsKey = requiresApiKey(formData.type ?? null);
  const needsURL = requiresBaseURL(formData.type ?? null);
  const canFetch = supportsModelFetching(formData.type ?? null);

  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = value as DbProviderType;
      onChange("type", newType);

      // Reset dependent fields when type changes
      onChange("apiKeyId", null);
      onChange("baseURL", null);
      onChange("autoFetchModels", supportsModelFetching(newType));

      // Auto-fill name if empty or matches old provider label
      const providerLabel = PROVIDER_TYPES.find(
        (p) => p.value === newType,
      )?.label;
      const oldProviderLabel = PROVIDER_TYPES.find(
        (p) => p.value === formData.type,
      )?.label;
      if (
        providerLabel &&
        (!formData.name?.trim() || formData.name === oldProviderLabel)
      ) {
        onChange("name", providerLabel);
      }
    },
    [onChange, formData.name, formData.type],
  );

  const relevantApiKeys = (apiKeys || []).filter(
    (key) => !formData.type || key.providerId === formData.type,
  );

  return (
    <div className={cn("space-y-3", className)}>
      {/* Use responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="provider-type">Provider Type</Label>
          <Select
            value={formData.type ?? ""}
            onValueChange={handleTypeChange}
            disabled={disabled}
          >
            <SelectTrigger id="provider-type">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-name">Provider Name</Label>
          <Input
            id="provider-name"
            value={formData.name || ""}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g., My Ollama"
            disabled={disabled}
            aria-label="Provider Name"
          />
        </div>

        {needsKey && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>API Key</Label>
            <ApiKeySelector
              label="API Key"
              selectedKeyId={formData.apiKeyId ?? null}
              onKeySelected={(keyId: string | null) =>
                onChange("apiKeyId", keyId)
              }
              apiKeys={relevantApiKeys}
              disabled={disabled || !formData.type}
            />
          </div>
        )}

        {needsURL && (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="provider-baseurl">Base URL</Label>
            <Input
              id="provider-baseurl"
              value={formData.baseURL || ""}
              onChange={(e) => onChange("baseURL", e.target.value)}
              placeholder="Base URL (e.g., http://localhost:11434)"
              disabled={disabled}
              aria-label="Base URL"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="provider-enabled"
            checked={formData.isEnabled ?? true}
            onCheckedChange={(checked) => onChange("isEnabled", checked)}
            disabled={disabled}
            aria-labelledby="provider-enabled-label"
          />
          <Label id="provider-enabled-label" htmlFor="provider-enabled">
            Enabled
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="provider-autofetch"
            checked={formData.autoFetchModels ?? false}
            onCheckedChange={(checked) => onChange("autoFetchModels", checked)}
            disabled={!canFetch || disabled}
            aria-labelledby="provider-autofetch-label"
          />
          <Label
            id="provider-autofetch-label"
            htmlFor="provider-autofetch"
            className={cn("text-sm", !canFetch ? "text-muted-foreground" : "")}
          >
            Auto-fetch models {canFetch ? "" : "(Not Supported)"}
          </Label>
        </div>
      </div>
    </div>
  );
};
