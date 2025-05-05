// src/components/LiteChat/common/ApiKeysForm.tsx
// FULL FILE
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { DbProviderType } from "@/types/litechat/provider";
import { PROVIDER_TYPES } from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";

interface ApiKeyFormProps {
  initialProviderType?: DbProviderType | null;
  initialName?: string;
  initialValue?: string;
  initialApiKeyId?: string | null; // Added prop
  onSave: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string | void>;
  onCancel: () => void;
  isSaving: boolean;
  className?: string;
}

export const ApiKeyForm: React.FC<ApiKeyFormProps> = ({
  initialProviderType = null,
  initialName = "",
  initialValue = "",
  initialApiKeyId = null, // Destructure new prop
  onSave,
  onCancel,
  isSaving,
  className,
}) => {
  const [keyName, setKeyName] = useState(initialName);
  const [keyValue, setKeyValue] = useState(initialValue);
  const [providerType, setProviderType] = useState<DbProviderType | null>(
    initialProviderType,
  );
  const keyInputRef = useRef<HTMLInputElement>(null);

  // Effect to sync state with initial props
  useEffect(() => {
    setKeyName(initialName);
    setKeyValue(initialValue);
    setProviderType(initialProviderType);
    // Note: initialApiKeyId is not directly used in the form's state,
    // but it's passed to AddProviderForm which uses it.
  }, [initialName, initialValue, initialProviderType, initialApiKeyId]);

  const handleProviderTypeChange = useCallback(
    (value: string) => {
      const newType = value as DbProviderType;
      setProviderType(newType);
      // Prefill name if empty or matches old provider label
      const providerLabel = PROVIDER_TYPES.find(
        (p) => p.value === newType,
      )?.label;
      const oldProviderLabel = PROVIDER_TYPES.find(
        (p) => p.value === providerType,
      )?.label;

      if (
        providerLabel &&
        (!keyName.trim() || keyName === `${oldProviderLabel}`)
      ) {
        setKeyName(`${providerLabel}`);
      }
      // Focus key input after selecting provider using requestAnimationFrame
      requestAnimationFrame(() => {
        keyInputRef.current?.focus();
      });
    },
    [keyName, providerType],
  );

  const handleSaveClick = useCallback(async () => {
    if (!keyName.trim() || !keyValue.trim() || !providerType) {
      toast.error("Key Name, Provider Type, and API Key Value are required.");
      return;
    }
    await onSave(keyName.trim(), providerType, keyValue.trim());
    // Resetting state is handled by the parent component calling onCancel or remounting
  }, [keyName, keyValue, providerType, onSave]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Use grid for layout, adjust columns for responsiveness */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="api-key-provider">Provider Type</Label>
          <Select
            value={providerType ?? ""}
            onValueChange={handleProviderTypeChange}
            disabled={isSaving}
          >
            <SelectTrigger id="api-key-provider">
              <SelectValue placeholder="Select Provider Type" />
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
          <Label htmlFor="api-key-name">Key Name</Label>
          <Input
            id="api-key-name"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g., My OpenAI Key"
            required
            disabled={isSaving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="api-key-value">API Key Value</Label>
          <Input
            ref={keyInputRef}
            id="api-key-value"
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="Enter your API key"
            required
            disabled={isSaving}
            autoComplete="new-password"
          />
        </div>
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
          disabled={
            isSaving || !keyName.trim() || !keyValue.trim() || !providerType
          }
          type="button"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save API Key"}
        </Button>
      </div>
    </div>
  );
};
