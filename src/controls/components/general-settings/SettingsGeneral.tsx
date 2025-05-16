// src/components/LiteChat/settings/SettingsGeneral.tsx
// Following the prout.tsx example pattern
import React, { useCallback, useEffect } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm, type AnyFieldApi } from "@tanstack/react-form"; 
import { z } from "zod"; // Using zod directly

// Import Radix/Shadcn components directly
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const settingsSchema = z.object({
  enableStreamingMarkdown: z.boolean(),
  enableStreamingCodeBlockParsing: z.boolean(),
  foldStreamingCodeBlocks: z.boolean(),
  foldUserMessagesOnCompletion: z.boolean(),
  enableAutoScrollOnStream: z.boolean(),
  streamingRenderFPS: z.number().min(3, "Min 3 FPS").max(60, "Max 60 FPS"),
  autoScrollInterval: z.number().min(50, "Min 50ms").max(5000, "Max 5000ms"),
});

// Simplified FieldInfo like in prout.tsx
function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive pl-2">{field.state.meta.errors.join(", ")}</em>
      ) : null}
      {/* {field.state.meta.isValidating ? "Validating..." : null} */}
    </>
  );
}

const SettingsGeneralComponent: React.FC = () => {
  const storeSetters = useSettingsStore(
    useShallow((state) => ({
      setEnableStreamingMarkdown: state.setEnableStreamingMarkdown,
      setEnableStreamingCodeBlockParsing: state.setEnableStreamingCodeBlockParsing,
      setFoldStreamingCodeBlocks: state.setFoldStreamingCodeBlocks,
      setFoldUserMessagesOnCompletion: state.setFoldUserMessagesOnCompletion,
      setStreamingRenderFPS: state.setStreamingRenderFPS,
      setAutoScrollInterval: state.setAutoScrollInterval,
      setEnableAutoScrollOnStream: state.setEnableAutoScrollOnStream,
      resetGeneralSettings: state.resetGeneralSettings,
    }))
  );
  const storeValues = useSettingsStore(
    useShallow((state) => ({
      enableStreamingMarkdown: state.enableStreamingMarkdown,
      enableStreamingCodeBlockParsing: state.enableStreamingCodeBlockParsing,
      foldStreamingCodeBlocks: state.foldStreamingCodeBlocks,
      foldUserMessagesOnCompletion: state.foldUserMessagesOnCompletion,
      streamingRenderFPS: state.streamingRenderFPS,
      autoScrollInterval: state.autoScrollInterval,
      enableAutoScrollOnStream: state.enableAutoScrollOnStream,
    }))
  );

  const form = useForm({
    defaultValues: {
      enableStreamingMarkdown: storeValues.enableStreamingMarkdown ?? true,
      enableStreamingCodeBlockParsing: storeValues.enableStreamingCodeBlockParsing ?? false,
      foldStreamingCodeBlocks: storeValues.foldStreamingCodeBlocks ?? false,
      foldUserMessagesOnCompletion: storeValues.foldUserMessagesOnCompletion ?? false,
      enableAutoScrollOnStream: storeValues.enableAutoScrollOnStream ?? true,
      streamingRenderFPS: storeValues.streamingRenderFPS ?? 15,
      autoScrollInterval: storeValues.autoScrollInterval ?? 1000,
    },
    validators: {
      onChangeAsync: settingsSchema, // Or onChange if sync validation is enough
      onChangeAsyncDebounceMs: 500, 
    },
    onSubmit: async ({ value }) => {
      storeSetters.setEnableStreamingMarkdown(value.enableStreamingMarkdown);
      storeSetters.setEnableStreamingCodeBlockParsing(value.enableStreamingCodeBlockParsing);
      storeSetters.setFoldStreamingCodeBlocks(value.foldStreamingCodeBlocks);
      storeSetters.setFoldUserMessagesOnCompletion(value.foldUserMessagesOnCompletion);
      storeSetters.setEnableAutoScrollOnStream(value.enableAutoScrollOnStream);
      storeSetters.setStreamingRenderFPS(value.streamingRenderFPS);
      storeSetters.setAutoScrollInterval(value.autoScrollInterval);
    },
  });

  useEffect(() => {
    form.reset({
        enableStreamingMarkdown: storeValues.enableStreamingMarkdown ?? true,
        enableStreamingCodeBlockParsing: storeValues.enableStreamingCodeBlockParsing ?? false,
        foldStreamingCodeBlocks: storeValues.foldStreamingCodeBlocks ?? false,
        foldUserMessagesOnCompletion: storeValues.foldUserMessagesOnCompletion ?? false,
        enableAutoScrollOnStream: storeValues.enableAutoScrollOnStream ?? true,
        streamingRenderFPS: storeValues.streamingRenderFPS ?? 15,
        autoScrollInterval: storeValues.autoScrollInterval ?? 1000,
    });
  }, [
    storeValues.enableStreamingMarkdown,
    storeValues.enableStreamingCodeBlockParsing,
    storeValues.foldStreamingCodeBlocks,
    storeValues.foldUserMessagesOnCompletion,
    storeValues.enableAutoScrollOnStream,
    storeValues.streamingRenderFPS,
    storeValues.autoScrollInterval,
    form, 
  ]);

  const handleResetClick = () => {
    if (window.confirm("Are you sure you want to reset Streaming & Display settings to their defaults?")) {
      storeSetters.resetGeneralSettings(); 
    }
  };
  
  // const autoScrollEnabled = form.state.values.enableAutoScrollOnStream; // Not used directly in JSX, can be derived within form.Subscribe if needed or kept if used elsewhere later.

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="p-1 space-y-6"
    >
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Streaming & Display</h3>
        
        {/* Using form.Field directly */}
        <form.Field
          name="enableStreamingMarkdown"
          children={(field) => (
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Parse Markdown While Streaming</Label>
                <p className={cn("text-sm text-muted-foreground")}>Render Markdown formatting as the response arrives (may impact performance slightly).</p>
              </div>
              <div className="flex flex-col items-end">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
                <FieldInfo field={field} />
              </div>
            </div>
          )}
        />

        <form.Field
          name="enableStreamingCodeBlockParsing"
          children={(field) => (
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Use Full Code Blocks While Streaming</Label>
                <p className={cn("text-sm text-muted-foreground")}>Use the syntax-highlighting component for code blocks during streaming.</p>
              </div>
              <div className="flex flex-col items-end">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
                <FieldInfo field={field} />
              </div>
            </div>
          )}
        />

        <form.Field
          name="foldStreamingCodeBlocks"
          children={(field) => (
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Fold Code Blocks by Default During Streaming</Label>
                <p className={cn("text-sm text-muted-foreground")}>Automatically collapse code blocks as they stream in. Useful for long code outputs.</p>
              </div>
              <div className="flex flex-col items-end">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
                <FieldInfo field={field} />
              </div>
            </div>
          )}
        />

        <form.Field
          name="foldUserMessagesOnCompletion"
          children={(field) => (
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Fold User Messages After Response</Label>
                <p className={cn("text-sm text-muted-foreground")}>Automatically collapse the user's prompt message once the assistant finishes responding.</p>
              </div>
              <div className="flex flex-col items-end">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
                <FieldInfo field={field} />
              </div>
            </div>
          )}
        />

        <form.Field
          name="enableAutoScrollOnStream"
          children={(field) => (
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Auto-Scroll While Streaming</Label>
                <p className={cn("text-sm text-muted-foreground")}>Automatically scroll to the bottom as new content arrives.</p>
              </div>
              <div className="flex flex-col items-end">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                />
                <FieldInfo field={field} />
              </div>
            </div>
          )}
        />

        <form.Field
          name="streamingRenderFPS"
          children={(field) => (
            <div className="rounded-lg border p-3 shadow-sm space-y-2">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Streaming Update Rate ({field.state.value} FPS)</Label>
                <p className={cn("text-sm text-muted-foreground")}>Controls how frequently the UI updates during streaming (3-60 FPS).</p>
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  id={field.name} // Or a more unique id like `${field.name}-slider`
                  min={3}
                  max={60}
                  step={1}
                  value={[field.state.value as number ?? 15]}
                  onValueChange={(value) => field.handleChange(value[0])}
                  onBlur={field.handleBlur}
                  className="flex-grow"
                />
                <Input 
                  type="number"
                  min={3}
                  max={60}
                  step={1}
                  value={field.state.value as number ?? 15}
                  onChange={(e) => {
                    const numValue = parseInt(e.target.value, 10);
                    if (!isNaN(numValue)) {
                      field.handleChange(Math.max(3, Math.min(60, numValue)));
                    } else if (e.target.value === '') {
                      field.handleChange(15); 
                    }
                  }}
                  onBlur={field.handleBlur}
                  className="w-20 h-8 text-xs"
                />
                <span className="text-xs text-muted-foreground">FPS</span>
              </div>
              <FieldInfo field={field} />
            </div>
          )}
        />

        <form.Field
          name="autoScrollInterval"
          children={(field) => (
            <div className="rounded-lg border p-3 shadow-sm space-y-2">
              <div className="space-y-0.5">
                <Label htmlFor={field.name}>Auto-Scroll Interval ({field.state.value} ms)</Label>
                <p className={cn("text-sm text-muted-foreground")}>How often to scroll to the bottom during streaming (50-5000 ms).</p>
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  id={field.name} // Or `${field.name}-slider`
                  min={50}
                  max={5000}
                  step={50}
                  value={[field.state.value as number ?? 1000]}
                  onValueChange={(value) => field.handleChange(value[0])}
                  onBlur={field.handleBlur}
                  className="flex-grow"
                  disabled={!form.state.values.enableAutoScrollOnStream}
                />
                <Input
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={field.state.value as number ?? 1000}
                  onChange={(e) => {
                    const numValue = parseInt(e.target.value, 10);
                    if (!isNaN(numValue)) {
                      field.handleChange(Math.max(50, Math.min(5000, numValue)));
                    } else if (e.target.value === '') {
                      field.handleChange(1000); 
                    }
                  }}
                  onBlur={field.handleBlur}
                  className="w-20 h-8 text-xs"
                  disabled={!form.state.values.enableAutoScrollOnStream}
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
              <FieldInfo field={field} />
            </div>
          )}
        />
      </div>

      <Separator />
      <div className="flex items-center justify-between pt-4">
            <form.Subscribe 
                children={(state) => {
                    const canSubmit = state.canSubmit;
                    const isSubmitting = state.isSubmitting;
                    const isValidating = state.isValidating;
                    const isValid = state.isValid;
                    return (
                      <div className="flex items-center space-x-2">
                        <Button 
                          type="submit" 
                          size="sm"
                          disabled={!canSubmit || isSubmitting || isValidating || !isValid}
                        >
                          {isSubmitting ? "Saving..." : isValidating ? "Validating..." : "Save Changes"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleResetClick} type="button">
                          <RotateCcwIcon className="mr-2 h-4 w-4" />
                          Reset General Settings
                        </Button>
                      </div>
                    );
                }}
           />
      </div>
    </form>
  );
};

export const SettingsGeneral = React.memo(SettingsGeneralComponent);
