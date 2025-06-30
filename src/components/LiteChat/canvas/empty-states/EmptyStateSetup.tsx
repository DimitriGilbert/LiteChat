// src/components/LiteChat/canvas/empty-states/EmptyStateSetup.tsx
// FULL FILE
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  AlertCircleIcon,
  MessageSquarePlusIcon,
  ChevronRightIcon,
  CheckCircle2Icon,
  KeyIcon,
  ServerIcon,
  BrainCircuitIcon,
  RocketIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import { ApiKeyForm } from "@/components/LiteChat/common/ApiKeysForm";
import { AddProviderForm } from "@/controls/components/provider-settings/AddProviderForm";
import type {
  DbProviderConfig,
  DbProviderType,
} from "@/types/litechat/provider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Lnk } from "@/components/ui/lnk";
import {
  requiresApiKey,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers";
import LCSettingsIcon from "@/components/LiteChat/common/icons/LCSettings";
import { OnBoardingRant } from "@/components/OnBoardingRant";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ActionCards } from "./ActionCards";
import { ModelEnablementList } from "@/controls/components/provider-settings/ModelEnablementList";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent } from "@/types/litechat/events/ui.events";

const SetupStep: React.FC<{
  stepNumber: number;
  title: string;
  description: React.ReactNode;
  isComplete: boolean;
  isActive: boolean;
  openOnComplete?: boolean;
  contentClassName?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({
  stepNumber,
  title,
  description,
  isComplete,
  isActive,
  openOnComplete = false,
  contentClassName = "",
  icon,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(isActive || (isComplete && openOnComplete));
  }, [isActive, isComplete, openOnComplete]);

  return (
    <Card
      className={`border border-border/40 bg-card/50 backdrop-blur-sm shadow-lg ${
        isComplete
          ? "border-l-4 border-l-green-500/70"
          : isActive
          ? "border-l-4 border-l-primary/70"
          : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center space-x-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              isComplete
                ? "bg-green-500/20 text-green-500"
                : isActive
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isComplete ? (
              <CheckCircle2Icon className="h-5 w-5" />
            ) : (
              <div className="flex items-center justify-center">{icon}</div>
            )}
          </div>
          <div className="flex-1">
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsOpen(!isOpen)}
            >
              <CardTitle className="text-base">
                <span className="opacity-60 mr-2">{stepNumber}.</span>
                {title}
              </CardTitle>
              <button
                className={`p-1 rounded-full transition-all ${
                  isOpen ? "rotate-90" : ""
                } hover:bg-muted/60`}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            {!isOpen && (
              <CardDescription className="text-xs mt-1">
                {typeof description === "string"
                  ? description.substring(0, 60) +
                    (description.length > 60 ? "..." : "")
                  : "Click to expand"}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <CardContent className="pt-2">
              {typeof description === "string" ? (
                <p className="text-sm text-muted-foreground mb-4">
                  {description}
                </p>
              ) : (
                <div className="text-sm text-muted-foreground mb-4">
                  {description}
                </div>
              )}
              <div className={contentClassName}>{children}</div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};

export const EmptyStateSetup: React.FC = () => {
  const { t } = useTranslation('canvas');
  
  const {
    apiKeys,
    addApiKey,
    providers,
    addProviderConfig,
    updateProviderConfig,
    getAllAvailableModelDefsForProvider,
    isLoading: isProviderLoading,
    enableApiKeyManagement,
  } = useProviderStore(
    useShallow((state) => ({
      apiKeys: state.dbApiKeys,
      addApiKey: state.addApiKey,
      providers: state.dbProviderConfigs, // This will trigger re-memo when its reference changes
      addProviderConfig: state.addProviderConfig,
      updateProviderConfig: state.updateProviderConfig,
      getAllAvailableModelDefsForProvider:
        state.getAllAvailableModelDefsForProvider,
      isLoading: state.isLoading,
      enableApiKeyManagement: state.enableApiKeyManagement,
    }))
  );

  const { addConversation, selectItem } = useConversationStore(
    useShallow((state) => ({
      addConversation: state.addConversation,
      selectItem: state.selectItem,
    }))
  );

  const [isSavingKey, setIsSavingKey] = useState(false);
  // @ts-expect-error - we do not use it but cant remove, thank you unamed array destruct ! @AI DONT TOUCH !!
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const isApiKeyStepComplete = useMemo(
    () => !enableApiKeyManagement || apiKeys.length > 0,
    [enableApiKeyManagement, apiKeys]
  );

  const isProviderStepComplete = useMemo(
    () => providers.length > 0,
    [providers]
  );

  const isEnableModelsStepComplete = useMemo(() => {
    return providers.some(
      (p) => p.isEnabled && p.enabledModels && p.enabledModels.length > 0
    );
  }, [providers]);

  const firstProvider = useMemo(() => {
    const sortedProviders = [...providers].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    return sortedProviders.length > 0 ? sortedProviders[0] : null;
  }, [providers]); // Depends directly on the `providers` array from the store

  // This will re-calculate if `firstProvider` changes (due to `providers` changing)
  // or if `getAllAvailableModelDefsForProvider` function reference changes (which it shouldn't often).
  const currentFirstProviderModels = useMemo(() => {
    if (!firstProvider) return [];
    return getAllAvailableModelDefsForProvider(firstProvider.id);
  }, [firstProvider, getAllAvailableModelDefsForProvider]);

  const firstProviderEnabledModels = useMemo(() => {
    // This correctly uses the `firstProvider` from the store, which reflects the latest `enabledModels`.
    return new Set(firstProvider?.enabledModels ?? []);
  }, [firstProvider]); // Depends on `firstProvider`

  const {
    initialProviderTypeForForm,
    initialProviderNameForForm,
    initialApiKeyIdForForm,
  } = useMemo(() => {
    if (isProviderStepComplete)
      return { type: undefined, name: undefined, keyId: undefined };
    if (apiKeys.length > 0) {
      const sortedKeys = [...apiKeys].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      const relevantKeyForProvider = sortedKeys.find((k) =>
        requiresApiKey(k.providerId as DbProviderType)
      );
      if (relevantKeyForProvider) {
        const type = relevantKeyForProvider.providerId as DbProviderType;
        const name =
          PROVIDER_TYPES.find((p) => p.value === type)?.label || type;
        return {
          initialProviderTypeForForm: type,
          initialProviderNameForForm: name,
          initialApiKeyIdForForm: relevantKeyForProvider.id,
        };
      }
    }
    return {
      initialProviderTypeForForm: undefined,
      initialProviderNameForForm: undefined,
      initialApiKeyIdForForm: undefined,
    };
  }, [apiKeys, isProviderStepComplete]);

  const handleSaveKey = useCallback(
    async (name: string, providerId: string, value: string) => {
      setIsSavingKey(true);
      try {
        await addApiKey(name, providerId, value);
        toast.success(t('common:apiKeyAddedSuccess'));
      } finally {
        setIsSavingKey(false);
      }
    },
    [addApiKey]
  );

  const handleSaveProvider = useCallback(
    async (
      config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">
    ): Promise<string> => {
      setIsSavingProvider(true);
      try {
        const configWithKey = {
          ...config,
          apiKeyId:
            config.apiKeyId ??
            (requiresApiKey(config.type)
              ? initialApiKeyIdForForm ?? null
              : null),
        };
        const newId = await addProviderConfig(configWithKey);
        toast.success(t('common:providerAddedSuccess'));
        return newId;
      } finally {
        setIsSavingProvider(false);
      }
    },
    [addProviderConfig, initialApiKeyIdForForm]
  );

  const handleModelToggle = useCallback(
    async (modelId: string, checked: boolean) => {
      if (!firstProvider) return;
      setIsUpdatingModels(true);
      const currentEnabledSet = new Set(firstProvider.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(modelId);
      } else {
        currentEnabledSet.delete(modelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);
      try {
        // When updateProviderConfig is called, the `providers` array in the store will update.
        // This will cause `firstProvider` to re-memoize.
        // Then `currentFirstProviderModels` will re-memoize using the new `firstProvider`.
        await updateProviderConfig(firstProvider.id, {
          enabledModels: newEnabledModels,
        });
        toast.success(
          checked
            ? t('common:modelEnabledSuccess')
            : t('common:modelDisabledSuccess')
        );
      } catch (error) {
        toast.error(t('common:failedToUpdateModel'));
        console.error("Failed to save model toggle:", error);
      } finally {
        setIsUpdatingModels(false);
      }
    },
    [firstProvider, updateProviderConfig]
  );

  const handleStartFirstChat = useCallback(async () => {
    setIsStartingChat(true);
    setShowProgress(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const newId = await addConversation({ title: t('common:newChat') });
      await selectItem(newId, "conversation");
      toast.success(t('common:welcomeFirstChat'));
          } catch (error) {
        toast.error(t('common:failedToStartChat'));
        console.error("Failed to start first chat:", error);
      setIsStartingChat(false);
      setShowProgress(false);
    }
  }, [addConversation, selectItem]);

  const openSettings = () => {
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "settingsModal",
      initialTab: "providers",
    });
  };

  const completedSteps = [
    isApiKeyStepComplete,
    isProviderStepComplete,
    isEnableModelsStepComplete,
  ].filter(Boolean).length;

  const totalSteps = enableApiKeyManagement ? 3 : 2;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  const steps = [
            ...(enableApiKeyManagement
          ? [
              {
                id: "api-key",
                title: t('emptyStateSetup.addApiKey'),
                            description: (
                  <div className="space-y-2">
                    <p>
                      {t('emptyStateSetup.addApiKeyDescription')}{" "}
                      <Lnk
                        href="https://platform.openai.com/api-keys"
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        OpenAI
                      </Lnk>
                      ,{" "}
                      <Lnk
                        href="https://aistudio.google.com/app/apikey"
                        className="text-green-600 hover:text-green-700 transition-colors"
                      >
                        Google
                      </Lnk>
                      ,{" "}
                      <Lnk
                        href="https://console.anthropic.com/settings/keys"
                        className="text-purple-500 hover:text-purple-700 transition-colors"
                      >
                        Anthropic (Claude)
                      </Lnk>
                      , or{" "}
                      <Lnk
                        href="https://openrouter.ai/keys"
                        className="text-orange-500 hover:text-orange-700 transition-colors"
                      >
                        OpenRouter
                      </Lnk>.
                    </p>
                    <p>
                      {t('emptyStateSetup.localAiDescription')}:{" "}
                      <Lnk
                        href="https://www.ollama.com/"
                        className="text-teal-500 hover:text-teal-700 transition-colors"
                      >
                        Ollama
                      </Lnk>{" "}
                      or{" "}
                      <Lnk
                        href="https://lmstudio.ai/"
                        className="text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        LMStudio
                      </Lnk>.
                    </p>
                  </div>
                ),
            isComplete: isApiKeyStepComplete,
            content: (
              <ApiKeyForm
                onSave={handleSaveKey}
                onCancel={() => {}}
                disabled={isSavingKey}
                className="border-none shadow-none p-0"
                initialProviderType={initialProviderTypeForForm}
              />
            ),
            icon: <KeyIcon className="h-4 w-4" />,
          },
        ]
      : []),
    {
      id: "add-provider",
      title: t('emptyStateSetup.addProvider'),
      description: (
        <div className="space-y-2">
          <p>{t('emptyStateSetup.addProviderDescription')}</p>
          <p>
            {t('emptyStateSetup.providerRedundancyNote')}
          </p>
        </div>
      ),
      isComplete: isProviderStepComplete,
      content: (
        <AddProviderForm
          apiKeys={apiKeys}
          onAddProvider={
            handleSaveProvider as (
              config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">
            ) => Promise<string>
          }
          onCancel={() => {}}
          initialType={initialProviderTypeForForm}
          initialName={initialProviderNameForForm}
          initialApiKeyId={initialApiKeyIdForForm}
        />
      ),
      icon: <ServerIcon className="h-4 w-4" />,
    },
    {
      id: "enable-models",
      title: t('emptyStateSetup.enableModels'),
      description: (
        <div className="space-y-2">
          <p>
            {t('emptyStateSetup.enableModelsDescription', { 
              providerName: firstProvider?.name || "..." 
            })}
          </p>
          <p>
            {t('emptyStateSetup.enableModelsNote')}
          </p>
          <p>
            {t('emptyStateSetup.enableModelsNote2')}
          </p>
        </div>
      ),
      isComplete: isEnableModelsStepComplete,
      content: firstProvider ? (
        <div className="bg-card/40 rounded-lg p-3 border border-border/30 shadow-inner">
          <ModelEnablementList
            providerId={firstProvider.id}
            allAvailableModels={currentFirstProviderModels}
            enabledModelIds={firstProviderEnabledModels}
            onToggleModel={handleModelToggle}
            isLoading={isProviderLoading || isUpdatingModels}
            listHeightClass="h-[26rem]"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic flex items-center">
          <AlertCircleIcon className="h-4 w-4 mr-2 text-amber-500" />
          {t('emptyStateSetup.addProviderFirst', { 
            stepNumber: enableApiKeyManagement ? "2" : "1" 
          })}
        </p>
      ),
      icon: <BrainCircuitIcon className="h-4 w-4" />,
    },
    {
      id: "start-chat",
      title: t('emptyStateSetup.startChatting'),
      description: t('emptyStateSetup.startChattingDescription'),
      isComplete: false,
      content: (
        <div>
          {showProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4"
            >
              <Progress
                value={isStartingChat ? undefined : 100}
                className="h-2"
              />
            </motion.div>
          )}

          <Button
            onClick={handleStartFirstChat}
            disabled={isStartingChat || !isEnableModelsStepComplete}
            className="w-full bg-gradient-to-r from-indigo-500 to-primary hover:opacity-90 transition-all"
          >
            <MessageSquarePlusIcon className="mr-2 h-4 w-4" />
            {isStartingChat ? t('emptyStateSetup.launching') : t('emptyStateSetup.startFirstChat')}
          </Button>
          <ActionCards />
        </div>
      ),
      contentClassName: "p-4",
      icon: <RocketIcon className="h-4 w-4" />,
    },
  ];

  const activeStepIndex = steps.findIndex((step) => !step.isComplete);

  if (isProviderLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 space-y-4 max-w-4xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <Skeleton className="h-12 w-1/2 mx-auto mb-6" />
          <Skeleton className="h-8 w-3/4 mx-auto mb-2" />
          <Skeleton className="h-4 w-1/2 mx-auto mb-8" />
          <Skeleton className="h-20 w-full mb-6" />
          <Skeleton className="h-20 w-full mb-6" />
          <Skeleton className="h-20 w-full" />
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-start p-4 bg-gradient-to-b from-background to-background/80"
    >
      <div className="w-full max-w-4xl space-y-6 pt-8">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <div className="relative mx-auto w-16 h-16 mb-4">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
              <div className="relative bg-gradient-to-br from-primary to-indigo-600 p-3 rounded-full">
                <LCSettingsIcon className="h-10 w-10 text-white" />
              </div>
            </div>
          </motion.div>
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
            {t('emptyStateSetup.welcomeTitle')}
          </h2>

          <OnBoardingRant />

        </div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl p-3 w-3/4 mx-auto">
                <Progress value={progressPercentage} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  {t('emptyStateSetup.setupProgress', { progress: Math.round(progressPercentage) })}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {t('emptyStateSetup.stepsCompleted', { completed: completedSteps, total: totalSteps })}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
              >
                <SetupStep
                  stepNumber={index + 1}
                  title={step.title}
                  description={step.description}
                  isComplete={step.id !== "start-chat" && step.isComplete}
                  isActive={isActive}
                  openOnComplete={step.id === "enable-models"}
                  contentClassName={
                    step.id === "add-provider" || step.id === "api-key"
                      ? "p-0 border-none shadow-none bg-transparent"
                      : step.contentClassName
                  }
                  icon={step.icon}
                >
                  {step.content}
                </SetupStep>
              </motion.div>
            );
          })}
        </motion.div>

        {!isProviderLoading &&
          !isProviderStepComplete &&
          activeStepIndex === -1 && (
            <motion.div
              className="text-center mt-6 p-4 bg-red-500/10 rounded-lg border border-red-500/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <AlertCircleIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm mb-3">
                {t('emptyStateSetup.configurationIssue')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={openSettings}
                className="border-red-500/50 hover:bg-red-500/20 transition-colors"
              >
                {t('emptyStateSetup.openProviderSettings')}
              </Button>
            </motion.div>
          )}
      </div>
    </div>
  );
};
