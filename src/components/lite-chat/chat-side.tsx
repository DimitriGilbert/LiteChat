import React, { useState } from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "./settings-modal";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react"; // Example icon
import { cn } from "@/lib/utils";

interface ChatSideProps {
  className?: string;
  defaultWidth?: string; // e.g., "w-64", "w-72"
}

export const ChatSide: React.FC<ChatSideProps> = ({
  className,
  defaultWidth = "w-72", // Default width
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-muted/40",
        defaultWidth,
        className,
      )}
    >
      <div className="flex-grow h-0">
        {" "}
        {/* History takes available space */}
        <ChatHistory />
      </div>
      <div className="flex-shrink-0 border-t p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
  );
};
