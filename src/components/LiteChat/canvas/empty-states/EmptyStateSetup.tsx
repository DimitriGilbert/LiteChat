// src/components/LiteChat/canvas/empty-states/EmptyStateSetup.tsx
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
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useProviderStore } from "@/store/provider.store";
import { useUIStateStore } from "@/store/ui.store";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import { ApiKeyForm } from "@/components/LiteChat/common/ApiKeysForm";
import { AddProviderForm } from "@/components/LiteChat/settings/AddProviderForm";
import type {
  DbProviderConfig,
  DbProviderType,
} from "@/types/litechat/provider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ModelEnablementList } from "@/components/LiteChat/settings/ModelEnablementList";
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

// Improved step component with animations
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
      className={`border border-border/40 bg-card/50 backdrop-blur-sm shadow-lg ${isComplete ? "border-l-4 border-l-green-500/70" : isActive ? "border-l-4 border-l-primary/70" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center space-x-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isComplete ? "bg-green-500/20 text-green-500" : isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
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
                className={`p-1 rounded-full transition-all ${isOpen ? "rotate-90" : ""} hover:bg-muted/60`}
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
      providers: state.dbProviderConfigs,
      addProviderConfig: state.addProviderConfig,
      updateProviderConfig: state.updateProviderConfig,
      getAllAvailableModelDefsForProvider:
        state.getAllAvailableModelDefsForProvider,
      isLoading: state.isLoading,
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );

  const { toggleChatControlPanel, setInitialSettingsTabs } = useUIStateStore(
    useShallow((state) => ({
      toggleChatControlPanel: state.toggleChatControlPanel,
      setInitialSettingsTabs: state.setInitialSettingsTabs,
    })),
  );

  const { addConversation, selectItem } = useConversationStore(
    useShallow((state) => ({
      addConversation: state.addConversation,
      selectItem: state.selectItem,
    })),
  );

  const [isSavingKey, setIsSavingKey] = useState(false);
  // @ts-expect-error @AI DO NOT REMOVE, DOES NOT BUILD IF REMOVED
  const [isSavingProvider, setIsSavingProvider] = useState(false); // DO NOT FUCKING REMOVE THE FUCKING TS-EXPECT-ERROR !
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  // --- Step Completion Logic ---
  const isApiKeyStepComplete = useMemo(
    () => !enableApiKeyManagement || apiKeys.length > 0,
    [enableApiKeyManagement, apiKeys],
  );

  const isProviderStepComplete = useMemo(
    () => providers.length > 0,
    [providers],
  );

  const isEnableModelsStepComplete = useMemo(() => {
    return providers.some(
      (p) => p.isEnabled && p.enabledModels && p.enabledModels.length > 0,
    );
  }, [providers]);
  // --- End Step Completion Logic ---

  // --- Get data for the first provider (if it exists) ---
  const firstProvider = useMemo(() => {
    const sortedProviders = [...providers].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return sortedProviders.length > 0 ? sortedProviders[0] : null;
  }, [providers]);

  const firstProviderModels = useMemo(() => {
    if (!firstProvider) return [];
    return getAllAvailableModelDefsForProvider(firstProvider.id);
  }, [firstProvider, getAllAvailableModelDefsForProvider]);

  const firstProviderEnabledModels = useMemo(() => {
    return new Set(firstProvider?.enabledModels ?? []);
  }, [firstProvider]);
  // --- End first provider data ---

  // Determine initial type, name, AND key ID for forms based on API keys
  const {
    initialProviderTypeForForm,
    initialProviderNameForForm,
    initialApiKeyIdForForm,
  } = useMemo(() => {
    if (isProviderStepComplete)
      return { type: undefined, name: undefined, keyId: undefined };
    if (apiKeys.length > 0) {
      const sortedKeys = [...apiKeys].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      // Find the *first* key that requires one for the provider form
      const relevantKeyForProvider = sortedKeys.find((k) =>
        requiresApiKey(k.providerId as DbProviderType),
      );
      if (relevantKeyForProvider) {
        const type = relevantKeyForProvider.providerId as DbProviderType;
        const name =
          PROVIDER_TYPES.find((p) => p.value === type)?.label || type;
        // Use this key's ID for both forms initially
        return {
          initialProviderTypeForForm: type,
          initialProviderNameForForm: name,
          initialApiKeyIdForForm: relevantKeyForProvider.id,
        };
      }
    }
    // Default if no relevant API key found
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
        toast.success("API key added successfully!");
      } finally {
        setIsSavingKey(false);
      }
    },
    [addApiKey],
  );

  const handleSaveProvider = useCallback(
    async (
      config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
    ): Promise<string> => {
      setIsSavingProvider(true);
      try {
        // Ensure the initial API key ID is passed if available and relevant
        const configWithKey = {
          ...config,
          apiKeyId:
            config.apiKeyId ??
            (requiresApiKey(config.type) ? initialApiKeyIdForForm : null),
        };
        // @ts-expect-error FO you MOFO
        const newId = await addProviderConfig(configWithKey);
        toast.success("Provider added successfully!");
        return newId;
      } finally {
        setIsSavingProvider(false);
      }
    },
    [addProviderConfig, initialApiKeyIdForForm], // Add dependency
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
        await updateProviderConfig(firstProvider.id, {
          enabledModels: newEnabledModels,
        });
        toast.success(
          checked
            ? "Model enabled successfully!"
            : "Model disabled successfully!",
        );
      } catch (error) {
        toast.error("Failed to update model status.");
        console.error("Failed to save model toggle:", error);
      } finally {
        setIsUpdatingModels(false);
      }
    },
    [firstProvider, updateProviderConfig],
  );

  const handleStartFirstChat = useCallback(async () => {
    setIsStartingChat(true);

    // Show progress animation
    setShowProgress(true);

    try {
      // Simulate some loading time if desired for better UX
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newId = await addConversation({ title: "New Chat" });
      await selectItem(newId, "conversation");

      toast.success("Welcome to your first chat!");
    } catch (error) {
      toast.error("Failed to start your first chat.");
      console.error("Failed to start first chat:", error);
      setIsStartingChat(false);
      setShowProgress(false);
    }
  }, [addConversation, selectItem]);

  const openSettings = (tab: string, subTab?: string) => {
    setInitialSettingsTabs(tab, subTab);
    toggleChatControlPanel("settingsModal", true);
  };

  // Calculate setup progress
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
            title: "Add API Key",
            description: (
              <div className="space-y-2">
                <p>
                  To use providers like{" "}
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
                  </Lnk>{" "}
                  or any OpenAI API compatible provider, add an API key. Keys
                  are stored securely in your browser.
                </p>
                <p>
                  If you want truly local AI, "no internet required", you can
                  setup{" "}
                  <Lnk
                    href="https://www.ollama.com/"
                    className="text-teal-500 hover:text-teal-700 transition-colors"
                  >
                    Ollama
                  </Lnk>{" "}
                  or,{" "}
                  <Lnk
                    href="https://lmstudio.ai/"
                    className="text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    LMStudio
                  </Lnk>{" "}
                  (or any other local LLM solution with an OpenAI compatible
                  API). These typically don't require API keys so see you in
                  step 2.
                </p>
              </div>
            ),
            isComplete: isApiKeyStepComplete,
            content: (
              <ApiKeyForm
                onSave={handleSaveKey}
                onCancel={() => {}}
                isSaving={isSavingKey}
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
      title: "Add AI Provider",
      description: (
        <div className="space-y-2">
          <p>Connect to an AI provider you configured the key for...</p>
          <p>
            This might look redundant, but it allows you to have multiple keys
            for the same provider (personal, professional, etc.)
          </p>
        </div>
      ),
      isComplete: isProviderStepComplete,
      content: (
        <AddProviderForm
          apiKeys={apiKeys}
          onAddProvider={
            handleSaveProvider as (
              config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
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
      title: "Enable Models",
      description: (
        <div className="space-y-2">
          <p>
            Enable models for the provider you just added (
            <span className="font-medium text-primary">
              {firstProvider?.name || "..."}
            </span>
            ).
          </p>
          <p>
            Enabling specific models improves the UI by reducing clutter and
            choice paralysis. You can enable more later in Settings.
          </p>
          <p>
            And just like before, you can choose to activate a model for a
            certain combination of key/provider!
          </p>
        </div>
      ),
      isComplete: isEnableModelsStepComplete,
      content: firstProvider ? (
        <div className="bg-card/40 rounded-lg p-3 border border-border/30 shadow-inner">
          <ModelEnablementList
            providerId={firstProvider.id}
            allAvailableModels={firstProviderModels}
            enabledModelIds={firstProviderEnabledModels}
            onToggleModel={handleModelToggle}
            isLoading={isProviderLoading || isUpdatingModels}
            listHeightClass="h-48"
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic flex items-center">
          <AlertCircleIcon className="h-4 w-4 mr-2 text-amber-500" />
          Add a provider in Step {enableApiKeyManagement ? "2" : "1"} first.
        </p>
      ),
      icon: <BrainCircuitIcon className="h-4 w-4" />,
    },
    {
      id: "start-chat",
      title: "Start Chatting",
      description: "You're all set! Click below to start your first chat.",
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
            {isStartingChat ? "Launching..." : "Start First Chat"}
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
    <motion.div
      className="flex h-full flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-background/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-full max-w-4xl space-y-6">
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
            Welcome to LiteChat
          </h2>

          <div className="relative">
            <OnBoardingRant />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-6 bg-card/40 backdrop-blur-sm border border-border/30 rounded-xl p-3 w-3/4 mx-auto">
                  <Progress value={progressPercentage} className="h-1.5" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Setup Progress: {Math.round(progressPercentage)}%
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Steps completed: {completedSteps} of {totalSteps}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
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
                Configuration issue detected. Please review provider settings.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSettings("providers")}
                className="border-red-500/50 hover:bg-red-500/20 transition-colors"
              >
                Open Provider Settings
              </Button>
            </motion.div>
          )}
      </div>
    </motion.div>
  );
};
