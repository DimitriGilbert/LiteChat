// src/controls/components/settings/ModelBrowserList.tsx
// FULL FILE
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchIcon, InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ModelFilterControls } from "@/controls/components/common/ModelFilterControls";
import { useTranslation } from "react-i18next";

interface ModelBrowserListProps {
  onSelectModelForDetails: (combinedModelId: string | null) => void;
}
type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

export const ModelBrowserList: React.FC<ModelBrowserListProps> = ({
  onSelectModelForDetails,
}) => {
  const { t } = useTranslation("settings");

  // Define formatPrice inside the component to use the `t` function
  const formatPrice = useCallback(
    (priceStr: string | null | undefined): string => {
      if (!priceStr) return t("modelBrowser.notApplicable");
      const priceNum = parseFloat(priceStr);
      if (isNaN(priceNum)) return t("modelBrowser.notApplicable");
      // OpenRouter pricing is per token, so multiply by 1M to show price per 1M tokens
      const pricePerMillion = priceNum * 1_000_000;
      return `$${pricePerMillion.toFixed(2)} ${t(
        "modelBrowser.perMillionTokens"
      )}`;
    },
    [t]
  );

  // @ts-expect-error we do not use it but cant remove, thank you unamed array destruct ! @AI DONT TOUCH !!
  const [scrollAreaContainer, setScrollAreaContainer] =
    useState<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null
  );

  const scrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setScrollAreaContainer(node);
      const vp = node.querySelector<HTMLDivElement>(
        "[data-radix-scroll-area-viewport]"
      );
      if (vp) {
        setViewportElement(vp);
      } else {
        const observer = new MutationObserver(() => {
          const observedVp = node.querySelector<HTMLDivElement>(
            "[data-radix-scroll-area-viewport]"
          );
          if (observedVp) {
            setViewportElement(observedVp);
            observer.disconnect();
          }
        });
        observer.observe(node, { childList: true, subtree: true });
        return () => observer.disconnect();
      }
    } else {
      setScrollAreaContainer(null);
      setViewportElement(null);
    }
  }, []);

  const { getAvailableModelListItems, isLoading, dbProviderConfigs } =
    useProviderStore(
      useShallow((state) => ({
        getAvailableModelListItems: state.getAvailableModelListItems,
        isLoading: state.isLoading,
        dbProviderConfigs: state.dbProviderConfigs,
      }))
    );

  const [filterText, setFilterText] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    () => new Set(dbProviderConfigs.map((p) => p.id))
  );
  const [capabilityFilters, setCapabilityFilters] = useState<
    Record<CapabilityFilter, boolean>
  >({
    reasoning: false,
    webSearch: false,
    tools: false,
    multimodal: false,
  });

  const allModelListItems = useMemo(
    () => getAvailableModelListItems(),
    [getAvailableModelListItems]
  );

  useEffect(() => {
    setSelectedProviders(new Set(dbProviderConfigs.map((p) => p.id)));
  }, [dbProviderConfigs]);

  const filteredModels = useMemo(() => {
    let models = allModelListItems;
    if (selectedProviders.size !== dbProviderConfigs.length) {
      models = models.filter((model) =>
        selectedProviders.has(model.providerId)
      );
    }
    if (filterText.trim()) {
      const query = filterText.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(query) ||
          model.providerName.toLowerCase().includes(query) ||
          model.id.toLowerCase().includes(query)
      );
    }
    const activeFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);

    if (activeFilters.length > 0) {
      models = models.filter((model) => {
        const supportedParams = new Set(
          model.metadataSummary?.supported_parameters ?? []
        );
        const inputModalities = new Set(
          model.metadataSummary?.input_modalities ?? []
        );
        return activeFilters.every((filter) => {
          switch (filter) {
            case "reasoning":
              return supportedParams.has("reasoning");
            case "webSearch":
              return (
                supportedParams.has("web_search") ||
                supportedParams.has("web_search_options")
              );
            case "tools":
              return supportedParams.has("tools");
            case "multimodal":
              return Array.from(inputModalities).some((mod) => mod !== "text");
            default:
              return true;
          }
        });
      });
    }
    return models.sort((a, b) => {
      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;
      return a.name.localeCompare(b.name);
    });
  }, [
    allModelListItems,
    filterText,
    selectedProviders,
    dbProviderConfigs.length,
    capabilityFilters,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: filteredModels.length,
    getScrollElement: () => viewportElement,
    estimateSize: () => 48,
    overscan: 10,
  });

  const handleRowClick = useCallback(
    (modelId: string) => {
      onSelectModelForDetails(modelId);
    },
    [onSelectModelForDetails]
  );

  const setCapabilityFiltersCallback = useCallback(
    (filters: Record<CapabilityFilter, boolean>) => {
      setCapabilityFilters(filters);
    },
    []
  );

  const totalActiveFilters = useMemo(
    () =>
      (selectedProviders.size !== dbProviderConfigs.length ? 1 : 0) +
      Object.values(capabilityFilters).filter(Boolean).length,
    [selectedProviders, dbProviderConfigs.length, capabilityFilters]
  );

  if (isLoading) {
    return (
      <div className="space-y-2 h-full flex flex-col">
        <Skeleton className="h-9 w-full flex-shrink-0" />
        <Skeleton className="h-full w-full flex-grow" />
      </div>
    );
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("modelBrowser.filterPlaceholder")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-8 w-full h-9"
            disabled={isLoading}
          />
        </div>
        <ModelFilterControls
          currentCapabilityFilters={capabilityFilters}
          onCapabilityFilterChange={setCapabilityFiltersCallback}
          currentSelectedProviders={selectedProviders}
          onProviderFilterChange={setSelectedProviders}
          allProviders={dbProviderConfigs}
          showProviderFilter={true}
          showCapabilityFilters={true}
          disabled={isLoading || dbProviderConfigs.length === 0}
          totalActiveFilters={totalActiveFilters}
        />
      </div>
      <ScrollArea
        className="flex-grow border rounded-md bg-background/50 h-[calc(15*2.5rem+2px)]"
        ref={scrollAreaRef}
      >
        {viewportElement && (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {filteredModels.length === 0 && !isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4 absolute inset-0 flex items-center justify-center">
                {t("modelBrowser.noModelsMatchFilters")}
              </p>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const model = filteredModels[virtualRow.index];
                if (!model) return null;
                return (
                  <div
                    key={model.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="p-1"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 text-left p-1.5 rounded hover:bg-muted/50 flex flex-col"
                        onClick={() => handleRowClick(model.id)}
                      >
                        <div className="flex flex-col items-start text-sm font-normal truncate">
                          <p>{model.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t(
                              "modelBrowser.byProvider",
                              "by {{providerName}}",
                              { providerName: model.providerName }
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoIcon className="h-4 w-4 pl-2 text-muted-foreground inline-block" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {t("modelBrowser.context", "Context")}:{" "}
                                    {model.metadataSummary?.context_length ??
                                      t("modelBrowser.notApplicable", "N/A")}
                                  </p>
                                  <p>
                                    {t(
                                      "modelBrowser.releaseDate",
                                      "Release Date"
                                    )}
                                    :{" "}
                                    {model.metadataSummary?.created
                                      ? new Date(
                                          model.metadataSummary.created * 1000
                                        ).toLocaleDateString()
                                      : t("modelBrowser.notApplicable", "N/A")}
                                  </p>
                                  <p>
                                    <span className="font-semibold">
                                      {t("modelBrowser.inputAbbr", "In:")}
                                    </span>{" "}
                                    {formatPrice(
                                      model.metadataSummary?.pricing?.prompt
                                    )}
                                  </p>
                                  <p>
                                    <span className="font-semibold">
                                      {t("modelBrowser.outputAbbr", "Out:")}
                                    </span>{" "}
                                    {formatPrice(
                                      model.metadataSummary?.pricing?.completion
                                    )}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
        {!viewportElement && !isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Initializing list...
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
