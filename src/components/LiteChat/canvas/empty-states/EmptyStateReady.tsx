// src/components/LiteChat/canvas/empty-states/EmptyStateReady.tsx
// FULL FILE
import React from "react";
import LCAddIcon from "@/components/LiteChat/common/icons/LCAdd";
import { ActionCards } from "./ActionCards";

export const EmptyStateReady: React.FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center p-4">
      <LCAddIcon className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Start Chatting</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Select an existing conversation or project from the sidebar, or click
        the '+' button to start a new chat. You can also explore these setup
        options:
      </p>

      <ActionCards />
    </div>
  );
};
