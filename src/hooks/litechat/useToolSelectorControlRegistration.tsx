// src/hooks/litechat/useToolSelectorControlRegistration.tsx
import { useEffect } from "react"; // Removed React import
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WrenchIcon } from "lucide-react";
// ToolSelectorControlComponent is rendered by PromptWrapper, not directly here
// import { ToolSelectorControlComponent } from "@/components/LiteChat/prompt/control/ToolSelectorControlComponent";
// useInputStore is not needed here, PromptWrapper handles metadata
// import { useInputStore } from "@/store/input.store";

export function useToolSelectorControlRegistration() {
  const registerPromptControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const isPanelOpen = useUIStateStore(
    (state) => state.isPromptControlPanelOpen["core-tool-selector"] ?? false,
  );
  const togglePanel = useUIStateStore(
    (state) => state.togglePromptControlPanel,
  );

  useEffect(() => {
    const controlId = "core-tool-selector";

    const unregister = registerPromptControl({
      id: controlId,
      order: 40, // Adjust order as needed
      show: () => true, // Always show the trigger
      triggerRenderer: () => {
        // Access enabledTools from PromptWrapper's state via a prop or context later
        // For now, just render the trigger
        return (
          <Popover
            open={isPanelOpen}
            onOpenChange={(open) => togglePanel(controlId, open)}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                <WrenchIcon className="h-3.5 w-3.5 mr-1" />
                Tools
                {/* Add indicator if tools are enabled */}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0"
              align="start"
              side="top"
              onOpenAutoFocus={(e) => e.preventDefault()} // Prevent focus stealing
            >
              {/* ToolSelectorControlComponent will be rendered by PromptWrapper */}
              {/* We need to pass enabledTools state and setter down */}
              {/* Placeholder comment: Pass state down here */}
            </PopoverContent>
          </Popover>
        );
      },
      // The actual component rendering the list is handled by PromptWrapper
      // based on the trigger state.
      // getMetadata needs to be implemented in PromptWrapper to read its local state.
      getMetadata: () => {
        // This needs to be implemented in PromptWrapper to access its state
        // Return { enabledTools: Array.from(enabledToolsState) }
        return undefined; // Placeholder
      },
      clearOnSubmit: () => {
        // Optionally clear selection on submit, or persist it.
        // For now, do nothing, selection persists until popover closes/remounts.
      },
    });

    return unregister;
  }, [registerPromptControl, isPanelOpen, togglePanel]);
}
