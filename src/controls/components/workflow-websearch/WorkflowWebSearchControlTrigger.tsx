// src/controls/components/workflow-websearch/WorkflowWebSearchControlTrigger.tsx

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon, LoaderIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { WorkflowWebSearchControlModule } from "../../modules/WorkflowWebSearchControlModule";

interface WorkflowWebSearchControlTriggerProps {
  module: WorkflowWebSearchControlModule;
}

export const WorkflowWebSearchControlTrigger: React.FC<
  WorkflowWebSearchControlTriggerProps
> = ({ module }) => {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const isEnabled = module.getIsEnabled();
  const isStreaming = module.getIsStreaming();
  const searchConfig = module.getSearchConfig();
  const deepSearchConfig = module.getDeepSearchConfig();
  const activeSearches = module.getActiveSearches();
  const hasActiveSearches = activeSearches.length > 0;

  const handleToggleEnabled = useCallback((enabled: boolean) => {
    module.setEnabled(enabled);
  }, [module]);

  const handleMaxResultsChange = useCallback((value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 20) {
      module.updateSearchConfig({ maxResults: numValue });
    }
  }, [module]);

  const handleDeepSearchToggle = useCallback((enabled: boolean) => {
    module.updateDeepSearchConfig({ enabled });
    // Switch workflow based on deep search setting
    module.selectWorkflow(enabled ? 'deep-websearch' : 'basic-websearch');
  }, [module]);

  const handleMaxDepthChange = useCallback((value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 5) {
      module.updateDeepSearchConfig({ maxDepth: numValue });
    }
  }, [module]);

  const handleDelayChange = useCallback((value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 10000) {
      module.updateSearchConfig({ delayBetweenRequests: numValue });
    }
  }, [module]);

  const getStatusIcon = () => {
    if (hasActiveSearches) {
      return <LoaderIcon className="h-4 w-4 animate-spin" />;
    }
    return <SearchIcon className="h-4 w-4" />;
  };

  const getTooltipText = () => {
    if (hasActiveSearches) {
      return `Web Search Running (${activeSearches.length} active)`;
    }
    if (isEnabled) {
      return `Web Search Enabled (${deepSearchConfig.enabled ? 'Deep' : 'Basic'})`;
    }
    return "Web Search Disabled";
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant={isEnabled ? "secondary" : "ghost"}
                size="icon"
                className={cn(
                  "h-8 w-8",
                  hasActiveSearches && "animate-pulse"
                )}
                disabled={isStreaming && !hasActiveSearches}
                aria-label="Web Search Settings"
              >
                {getStatusIcon()}
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          
          <PopoverContent align="end" className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Web Search Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Configure web search behavior
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Enable/Disable Switch */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="websearch-enabled" className="text-sm font-medium">
                    Enable Web Search
                  </Label>
                  <Switch
                    id="websearch-enabled"
                    checked={isEnabled}
                    onCheckedChange={handleToggleEnabled}
                  />
                </div>

                {/* Max Results */}
                <div className="space-y-2">
                  <Label htmlFor="max-results" className="text-sm font-medium">
                    Number of Search Queries
                  </Label>
                  <Input
                    id="max-results"
                    type="number"
                    min="1"
                    max="20"
                    value={searchConfig.maxResults}
                    onChange={(e) => handleMaxResultsChange(e.target.value)}
                    className="h-8"
                  />
                </div>

                {/* Deep Search Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="deep-search" className="text-sm font-medium">
                    Deep Search
                  </Label>
                  <Switch
                    id="deep-search"
                    checked={deepSearchConfig.enabled}
                    onCheckedChange={handleDeepSearchToggle}
                  />
                </div>

                {/* Deep Search Depth (only show if deep search enabled) */}
                {deepSearchConfig.enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="search-depth" className="text-sm font-medium">
                      Number of Search Turns
                    </Label>
                    <Input
                      id="search-depth"
                      type="number"
                      min="1"
                      max="5"
                      value={deepSearchConfig.maxDepth}
                      onChange={(e) => handleMaxDepthChange(e.target.value)}
                      className="h-8"
                    />
                  </div>
                )}

                {/* Delay Between Requests */}
                <div className="space-y-2">
                  <Label htmlFor="request-delay" className="text-sm font-medium">
                    Delay Between Content Fetching (ms)
                  </Label>
                  <Input
                    id="request-delay"
                    type="number"
                    min="0"
                    max="10000"
                    step="100"
                    value={searchConfig.delayBetweenRequests}
                    onChange={(e) => handleDelayChange(e.target.value)}
                    className="h-8"
                  />
                </div>

                {/* Active Searches Status */}
                {hasActiveSearches && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderIcon className="h-4 w-4 animate-spin" />
                      {activeSearches.length} Active Search{activeSearches.length !== 1 ? 'es' : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        <TooltipContent side="top">
          {getTooltipText()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};