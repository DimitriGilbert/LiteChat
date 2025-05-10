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
import { UrlParameterControlModule } from "@/controls/modules/UrlParameterControlModule"; // New Module

// Define the application's specific control module registration order HERE
const controlModulesToRegister: ControlModuleConstructor[] = [
  // Core functional modules (no UI, but initialize early)
  UrlParameterControlModule, // New: Handles URL parameters on init

  // Layout Controls (Sidebar, Header, Footer)
  ConversationListControlModule,
  SidebarToggleControlModule,
  SettingsControlModule,
  ProjectSettingsControlModule,

  // Prompt Controls (Order matters for visual layout in the prompt bar)
  GlobalModelSelectorModule,
  AutoTitleControlModule,
  UsageDisplayControlModule,
  ReasoningControlModule,
  WebSearchControlModule,
  FileControlModule,
  VfsControlModule,
  RulesControlModule,
  SystemPromptControlModule,
  ToolSelectorControlModule,
  ParameterControlModule,
  StructuredOutputControlModule,
  GitSyncControlModule,

  // Tools (Registration order doesn't affect UI directly)
  VfsToolsModule,
  GitToolsModule,
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
