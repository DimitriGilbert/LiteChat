// src/hooks/litechat/useToolSelectorControlRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useInputStore } from "@/store/input.store"; // Import input store
import { WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToolSelectorControlComponent } from "@/components/LiteChat/prompt/control/ToolSelectorControlComponent";
import { Badge } from "@/components/ui/badge"; // Import Badge

export function useToolSelectorControlRegistration() {
  const registerPromptControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );

  useEffect(() => {
    const unregister = registerPromptControl({
      id: "core-tool-selector",
      order: 30, // Adjust order as needed
      show: () => {
        // Show only if there are tools registered
        return Object.keys(useControlRegistryStore.getState().tools).length > 0;
      },
      // Trigger renders the button and popover structure
      triggerRenderer: () => {
        // Read enabledTools count directly from the store for the badge
        const enabledToolsCount = useInputStore.getState().enabledTools.size;

        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 relative" // Add relative positioning for badge
                aria-label="Select Tools"
              >
                <WrenchIcon className="h-4 w-4 mr-1" />
                Tools
                {enabledToolsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 px-1.5 py-0 text-[10px] leading-none rounded-full"
                  >
                    {enabledToolsCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              {/* The component is rendered inside the PopoverContent */}
              <ToolSelectorControlComponent />
            </PopoverContent>
          </Popover>
        );
      },
      // Panel renderer is not needed as the component is in the Popover
      renderer: undefined,
      // Get metadata reads from InputStore
      getMetadata: () => {
        const enabledTools = useInputStore.getState().enabledTools;
        // Return empty array if set is empty, otherwise convert set to array
        return {
          enabledTools:
            enabledTools.size > 0 ? Array.from(enabledTools) : undefined,
        };
      },
      // Clear on submit clears the InputStore state
      clearOnSubmit: () => {
        useInputStore.getState().setEnabledTools(() => new Set());
      },
    });

    return unregister; // Cleanup on unmount
  }, [registerPromptControl]);
}
