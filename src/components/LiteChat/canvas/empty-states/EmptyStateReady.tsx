// src/components/LiteChat/canvas/empty-states/EmptyStateReady.tsx
// FULL FILE
import React from "react";
import LCAddIcon from "@/components/LiteChat/common/icons/LCAdd";
import { Button } from "@/components/ui/button";
import {
  PaletteIcon,
  TagsIcon,
  HardDriveIcon,
  ServerIcon,
  KeyIcon,
  ArrowRightIcon,
} from "lucide-react";
import { useUIStateStore } from "@/store/ui.store";
import { useShallow } from "zustand/react/shallow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Interface for the action card props
interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

// Reusable Action Card component
const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  onClick,
}) => (
  <Card
    className="hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group"
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        {icon} {title}
      </CardTitle>
      <ArrowRightIcon className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
    </CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export const EmptyStateReady: React.FC = () => {
  const { toggleChatControlPanel, setInitialSettingsTabs, toggleVfsModal } =
    useUIStateStore(
      useShallow((state) => ({
        toggleChatControlPanel: state.toggleChatControlPanel,
        setInitialSettingsTabs: state.setInitialSettingsTabs,
        toggleVfsModal: state.toggleVfsModal,
      })),
    );

  const openSettings = (tab: string, subTab?: string) => {
    setInitialSettingsTabs(tab, subTab);
    toggleChatControlPanel("settingsModal", true);
  };

  const openVfs = () => {
    toggleVfsModal(true);
  };

  const actions = [
    {
      title: "Configure Theme",
      description: "Customize colors, fonts, and code block appearance.",
      icon: <PaletteIcon className="h-4 w-4 text-purple-500" />,
      onClick: () => openSettings("theme"),
    },
    {
      title: "Manage Rules & Tags",
      description: "Define reusable prompt snippets and organize them.",
      icon: <TagsIcon className="h-4 w-4 text-blue-500" />,
      onClick: () => openSettings("rules-tags"),
    },
    {
      title: "Add Files",
      description: "Upload or manage files in the virtual filesystem.",
      icon: <HardDriveIcon className="h-4 w-4 text-cyan-500" />,
      onClick: openVfs,
    },
    {
      title: "Add Provider",
      description: "Connect to AI services like OpenAI, Ollama, etc.",
      icon: <ServerIcon className="h-4 w-4 text-green-500" />,
      onClick: () => openSettings("providers", "providers-config"),
    },
    {
      title: "Add API Key",
      description: "Store API keys securely in your browser.",
      icon: <KeyIcon className="h-4 w-4 text-amber-500" />,
      onClick: () => openSettings("providers", "api-keys"),
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center text-center p-4">
      <LCAddIcon className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">Start Chatting</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Select an existing conversation or project from the sidebar, or click
        the '+' button to start a new chat. You can also explore these setup
        options:
      </p>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full">
        {actions.map((action) => (
          <ActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            onClick={action.onClick}
          />
        ))}
      </div>
    </div>
  );
};
