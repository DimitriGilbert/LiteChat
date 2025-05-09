// src/App.tsx
// FULL FILE
import { LiteChat } from "@/components/LiteChat/LiteChat";
import { PrismThemeLoader } from "@/components/LiteChat/common/PrismThemeLoader";
import { ThemeManager } from "@/components/LiteChat/common/ThemeManager";
import { ErrorBoundary } from "@/components/LiteChat/common/ErrorBoundary";
import type { ControlModuleConstructor } from "@/types/litechat/control";

// Import ALL Control Module classes
import { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule";
import { SettingsControlModule } from "@/controls/modules/SettingsControlModule";
import { SidebarToggleControlModule } from "@/controls/modules/SidebarToggleControlModule";
import { ParameterControlModule } from "@/controls/modules/ParameterControlModule";
import { FileControlModule } from "@/controls/modules/FileControlModule";
import { VfsControlModule } from "@/controls/modules/VfsControlModule";
import { GitSyncControlModule } from "@/controls/modules/GitSyncControlModule";
import { VfsToolsModule } from "@/controls/modules/VfsToolsModule";
import { GitToolsModule } from "@/controls/modules/GitToolsModule";
import { ToolSelectorControlModule } from "@/controls/modules/ToolSelectorControlModule";
import { ProjectSettingsControlModule } from "@/controls/modules/ProjectSettingsControlModule";
import { GlobalModelSelectorModule } from "@/controls/modules/GlobalModelSelectorModule";
import { SystemPromptControlModule } from "@/controls/modules/SystemPromptControlModule";
import { StructuredOutputControlModule } from "@/controls/modules/StructuredOutputControlModule";
import { UsageDisplayControlModule } from "@/controls/modules/UsageDisplayControlModule";
import { ReasoningControlModule } from "@/controls/modules/ReasoningControlModule";
import { WebSearchControlModule } from "@/controls/modules/WebSearchControlModule";
import { RulesControlModule } from "@/controls/modules/RulesControlModule";
import { AutoTitleControlModule } from "@/controls/modules/AutoTitleControlModule";

// Define the application's specific control module registration order HERE
const controlModulesToRegister: ControlModuleConstructor[] = [
  // Layout Controls (Sidebar, Header, Footer)
  // These might have dependencies on core stores but not typically on other UI controls.
  ConversationListControlModule, // Depends on ConversationStore, ProjectStore
  SidebarToggleControlModule, // Depends on UIStateStore
  SettingsControlModule, // Depends on UIStateStore, SettingsStore, ProviderStore, ModStore etc.
  ProjectSettingsControlModule, // Depends on UIStateStore, ProjectStore, ProviderStore etc.

  // Prompt Controls (Order matters for visual layout in the prompt bar)
  // These often depend on ProviderStore (for model capabilities) and PromptStateStore/InputStore
  GlobalModelSelectorModule, // Depends on ProviderStore, PromptStateStore, InteractionStore
  AutoTitleControlModule, // Depends on SettingsStore, InteractionStore
  UsageDisplayControlModule, // Depends on ProviderStore, InputStore, InteractionStore
  ReasoningControlModule, // Depends on ProviderStore, PromptStateStore, InteractionStore
  WebSearchControlModule, // Depends on ProviderStore, PromptStateStore, InteractionStore
  FileControlModule, // Depends on InputStore, ProviderStore, InteractionStore
  VfsControlModule, // Depends on VfsStore, UIStateStore, InputStore
  RulesControlModule, // Depends on RulesStore, InteractionStore
  SystemPromptControlModule, // Depends on various stores for effective prompt
  ToolSelectorControlModule, // Depends on ControlRegistryStore, ProviderStore, ConversationStore, SettingsStore
  ParameterControlModule, // Depends on ProviderStore, PromptStateStore, SettingsStore
  StructuredOutputControlModule, // Depends on ProviderStore, PromptStateStore
  GitSyncControlModule, // Depends on ConversationStore, InteractionStore

  // Tools (Registration order doesn't affect UI directly, but might have init dependencies)
  // These typically register themselves with ControlRegistryStore.
  VfsToolsModule, // Depends on VfsStore (implicitly, for fsInstance in tool execution)
  GitToolsModule, // Depends on SettingsStore, VfsStore (implicitly)
];

function App() {
  return (
    <ErrorBoundary>
      <ThemeManager />
      <PrismThemeLoader />
      <div className="h-screen bg-background text-foreground flex flex-col">
        <main className="flex-grow overflow-hidden">
          <LiteChat controls={controlModulesToRegister} />
        </main>
      </div>
    </ErrorBoundary>
  );
}
export default App;
