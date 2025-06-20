import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PaletteIcon,
  TagsIcon,
  HardDriveIcon,
  ServerIcon,
  KeyIcon,
  GitBranchIcon,
  ArrowRightIcon,
} from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent } from "@/types/litechat/events/ui.events";

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

export const ActionCards: React.FC = () => {
  const openSettings = (tab: string, subTab?: string) => {
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "settingsModal",
      initialTab: tab,
      initialSubTab: subTab,
    });
  };

  const openVfs = () => {
    emitter.emit(uiEvent.openModalRequest, {
      modalId: "core-vfs-modal-panel",
    });
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
    {
      title: "Setup Git Sync",
      description: "Configure repositories to sync conversations with Git.",
      icon: <GitBranchIcon className="h-4 w-4 text-orange-500" />,
      onClick: () => openSettings("git"),
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full pt-4">
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
  );
};
