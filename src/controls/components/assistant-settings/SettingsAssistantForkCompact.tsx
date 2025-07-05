import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_FORK_COMPACT_PROMPT = `Please provide a detailed but concise summary of our conversation so far. Include:

1. **Main Topics**: Key subjects we've discussed
2. **Important Decisions**: Any conclusions or agreements reached  
3. **Action Items**: Tasks or next steps identified
4. **Context**: Essential background information for continuing our discussion
5. **Current Status**: Where we left off and what we were working on

Keep the summary comprehensive enough that someone could understand the full context and continue our conversation seamlessly, but concise enough to be easily digestible. Focus on actionable information and key insights rather than verbose details.`;

export const SettingsAssistantForkCompact: React.FC = () => {
  const { t } = useTranslation('assistantSettings');
  const [isSaving, setIsSaving] = useState(false);
  const [localPrompt, setLocalPrompt] = useState("");
  const [localModelId, setLocalModelId] = useState<string | null>(null);

  const { 
    forkCompactPrompt, 
    forkCompactModelId,
    setForkCompactPrompt,
    setForkCompactModelId 
  } = useSettingsStore(
    useShallow((state) => ({
      forkCompactPrompt: state.forkCompactPrompt,
      forkCompactModelId: state.forkCompactModelId,
      setForkCompactPrompt: state.setForkCompactPrompt,
      setForkCompactModelId: state.setForkCompactModelId,
    }))
  );

  const { globallyEnabledModels } = useProviderStore(
    useShallow((state) => ({
      globallyEnabledModels: state.getGloballyEnabledModelDefinitions(),
    }))
  );

  // Initialize local state from store
  useEffect(() => {
    setLocalPrompt(forkCompactPrompt || DEFAULT_FORK_COMPACT_PROMPT);
    setLocalModelId(forkCompactModelId);
  }, [forkCompactPrompt, forkCompactModelId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setForkCompactPrompt(localPrompt);
      setForkCompactModelId(localModelId);
      toast.success(t('forkCompact.saveSuccess'));
    } catch (error) {
      console.error("Failed to save fork compact settings:", error);
      toast.error(t('forkCompact.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm(t('forkCompact.resetConfirm'))) {
      setLocalPrompt(DEFAULT_FORK_COMPACT_PROMPT);
      setLocalModelId(null);
      setForkCompactPrompt(DEFAULT_FORK_COMPACT_PROMPT);
      setForkCompactModelId(null);
      toast.success(t('forkCompact.resetSuccess'));
    }
  };

  const hasChanges = 
    localPrompt !== (forkCompactPrompt || DEFAULT_FORK_COMPACT_PROMPT) ||
    localModelId !== forkCompactModelId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('forkCompact.title')}</CardTitle>
          <CardDescription>
            {t('forkCompact.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="fork-compact-model">{t('forkCompact.defaultModel')}</Label>
            <Select 
              value={localModelId || "__default__"} 
              onValueChange={(value) => setLocalModelId(value === "__default__" ? null : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('forkCompact.useCurrentModel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">{t('forkCompact.useCurrentModel')}</SelectItem>
                {globallyEnabledModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} ({model.providerName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('forkCompact.modelHelp')}
            </p>
          </div>

          {/* Prompt Configuration */}
          <div className="space-y-2">
            <Label htmlFor="fork-compact-prompt">{t('forkCompact.promptLabel')}</Label>
            <Textarea
              id="fork-compact-prompt"
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder={t('forkCompact.promptPlaceholder')}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t('forkCompact.promptHelp')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcwIcon className="mr-2 h-4 w-4" />
              {t('forkCompact.resetToDefault')}
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 