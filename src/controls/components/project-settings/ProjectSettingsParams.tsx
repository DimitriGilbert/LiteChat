// src/components/LiteChat/project-settings/ProjectSettingsParams.tsx
// REFACTORED to render fields for a parent TanStack Form - Addressing linter errors

import React from "react";
// Using 'any' for FormApi generic due to persistent linter issues with type argument counts.
// The actual ProjectSettingsFormValues type will be defined in ProjectSettingsModal.tsx.
// Import AnyFieldApi directly
import type {  AnyFieldApi } from "@tanstack/react-form"; 
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// import type { ProjectSettingsFormValues } from "./ProjectSettingsModal"; // This will be uncommented/fixed later

// Type field prop with AnyFieldApi directly
function FieldInfo({ field }: { field: AnyFieldApi }) { 
  return field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
    <em className="text-xs text-destructive pt-1 block">
      {field.state.meta.errors.join(", ")}
    </em>
  ) : null;
}

interface ProjectSettingsParamsProps {
  form: any; // Using any for TFormData due to import cycle / linter issues
  isSaving: boolean;
  effectiveTemperature: number | null;
  effectiveMaxTokens: number | null;
  effectiveTopP: number | null;
  effectiveTopK: number | null;
  effectivePresencePenalty: number | null;
  effectiveFrequencyPenalty: number | null;
}

export const ProjectSettingsParams: React.FC<ProjectSettingsParamsProps> = ({
  form,
  isSaving,
  effectiveTemperature,
  effectiveMaxTokens,
  effectiveTopP,
  effectiveTopK,
  effectivePresencePenalty,
  effectiveFrequencyPenalty,
}) => {
  return (
    <div className="space-y-4">
      <form.Field
        name="temperature"
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs">
              Temperature ({(field.state.value ?? effectiveTemperature ?? 0.7).toFixed(2)})
            </Label>
            <Slider
              id={field.name}
              min={0}
              max={1}
              step={0.01}
              value={[field.state.value ?? effectiveTemperature ?? 0.7]}
              onValueChange={(v) => field.handleChange(v[0])} 
              onBlur={field.handleBlur} 
              disabled={isSaving}
            />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => field.handleChange(null)} 
              disabled={isSaving || field.state.value === null}
            >
              Use Inherited/Default ({effectiveTemperature?.toFixed(2) ?? "N/A"})
            </Button>
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Field
        name="topP"
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs">
              Top P ({(field.state.value ?? effectiveTopP ?? 1.0).toFixed(2)})
            </Label>
            <Slider
              id={field.name}
              min={0}
              max={1}
              step={0.01}
              value={[field.state.value ?? effectiveTopP ?? 1.0]}
              onValueChange={(v) => field.handleChange(v[0])}
              onBlur={field.handleBlur}
              disabled={isSaving}
            />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => field.handleChange(null)}
              disabled={isSaving || field.state.value === null}
            >
              Use Inherited/Default ({effectiveTopP?.toFixed(2) ?? "N/A"})
            </Button>
            <FieldInfo field={field} />
          </div>
        )}
      />
      <div className="grid grid-cols-2 gap-4 items-end">
        <form.Field
          name="maxTokens"
          children={(field: AnyFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-xs">Max Tokens</Label>
              <Input
                id={field.name}
                type="number"
                placeholder={`Inherited: ${effectiveMaxTokens ?? "Default"}`}
                value={field.state.value ?? ""} 
                onChange={(e) => field.handleChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                onBlur={field.handleBlur}
                min="1"
                className="h-8 text-xs"
                disabled={isSaving}
              />
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0 text-muted-foreground"
                onClick={() => field.handleChange(null)}
                disabled={isSaving || field.state.value === null}
              >
                Use Inherited/Default
              </Button>
              <FieldInfo field={field} />
            </div>
          )}
        />
        <form.Field
          name="topK"
          children={(field: AnyFieldApi) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-xs">Top K</Label>
              <Input
                id={field.name}
                type="number"
                placeholder={`Inherited: ${effectiveTopK ?? "Default"}`}
                value={field.state.value ?? ""} 
                onChange={(e) => field.handleChange(e.target.value === "" ? null : parseInt(e.target.value, 10))}
                onBlur={field.handleBlur}
                min="1"
                className="h-8 text-xs"
                disabled={isSaving}
              />
              <Button
                variant="link"
                size="sm"
                className="text-xs h-auto p-0 text-muted-foreground"
                onClick={() => field.handleChange(null)}
                disabled={isSaving || field.state.value === null}
              >
                Use Inherited/Default
              </Button>
              <FieldInfo field={field} />
            </div>
          )}
        />
      </div>
      <form.Field
        name="presencePenalty"
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs">
              Presence Penalty ({(field.state.value ?? effectivePresencePenalty ?? 0.0).toFixed(2)})
            </Label>
            <Slider
              id={field.name}
              min={-2}
              max={2}
              step={0.01}
              value={[field.state.value ?? effectivePresencePenalty ?? 0.0]}
              onValueChange={(v) => field.handleChange(v[0])}
              onBlur={field.handleBlur}
              disabled={isSaving}
            />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => field.handleChange(null)}
              disabled={isSaving || field.state.value === null}
            >
              Use Inherited/Default ({effectivePresencePenalty?.toFixed(2) ?? "N/A"})
            </Button>
            <FieldInfo field={field} />
          </div>
        )}
      />
      <form.Field
        name="frequencyPenalty"
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={field.name} className="text-xs">
              Frequency Penalty ({(field.state.value ?? effectiveFrequencyPenalty ?? 0.0).toFixed(2)})
            </Label>
            <Slider
              id={field.name}
              min={-2}
              max={2}
              step={0.01}
              value={[field.state.value ?? effectiveFrequencyPenalty ?? 0.0]}
              onValueChange={(v) => field.handleChange(v[0])}
              onBlur={field.handleBlur}
              disabled={isSaving}
            />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => field.handleChange(null)}
              disabled={isSaving || field.state.value === null}
            >
              Use Inherited/Default ({effectiveFrequencyPenalty?.toFixed(2) ?? "N/A"})
            </Button>
            <FieldInfo field={field} />
          </div>
        )}
      />
    </div>
  );
};
