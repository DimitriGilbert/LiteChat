// src/controls/modules/canvas/ExplainSelectionControlModule.ts
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { SelectionControlContext } from "@/types/litechat/canvas/control";
import { ExplainSelectionControl } from "@/controls/components/canvas/ExplainSelectionControl";

export class ExplainSelectionControlModule implements ControlModule {
  readonly id = "core-selection-explain";

  private unregisterCallback: (() => void) | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {}

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerSelectionControl({
      id: this.id,
      renderer: (context: SelectionControlContext) => {
        return React.createElement(ExplainSelectionControl, { context });
      },
      showCondition: (context: SelectionControlContext) => {
        // Only show if we have selected text AND an interaction ID (can only explain existing responses)
        return context.selectedText.length > 0 && !!context.interactionId;
      },
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}