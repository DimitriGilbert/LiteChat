// src/controls/modules/canvas/QuoteSelectionControlModule.ts
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { SelectionControlContext } from "@/types/litechat/canvas/control";
import { QuoteSelectionControl } from "@/controls/components/canvas/QuoteSelectionControl";

export class QuoteSelectionControlModule implements ControlModule {
  readonly id = "core-selection-quote";

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
        return React.createElement(QuoteSelectionControl, { context });
      },
      showCondition: (context: SelectionControlContext) => {
        // Only show if we have selected text
        return context.selectedText.length > 0;
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