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
import { UrlParameterControlModule } from "@/controls/modules/UrlParameterControlModule";

// Import new/updated Settings Modules
import { GeneralSettingsModule } from "@/controls/modules/GeneralSettingsModule";
import { ThemeSettingsControlModule } from "@/controls/modules/ThemeSettingsControlModule";
import { ProviderSettingsModule } from "@/controls/modules/ProviderSettingsModule";
import { AssistantSettingsModule } from "@/controls/modules/AssistantSettingsModule";
import { DataSettingsModule } from "@/controls/modules/DataSettingsModule";
import { ModSettingsModule } from "@/controls/modules/ModSettingsModule";

// Import canvas action control modules
import { CopyActionControlModule } from "@/controls/modules/canvas/CopyActionControlModule";
import { RegenerateActionControlModule } from "@/controls/modules/canvas/RegenerateActionControlModule";
import { RatingActionControlModule } from "@/controls/modules/canvas/RatingActionControlModule";
import { ExampleCanvasControlModule } from "@/controls/modules/example";
import { FoldInteractionControlModule } from "@/controls/modules/canvas/interaction/FoldInteractionControlModule";
import { CopyCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/CopyCodeBlockControlModule";
import { FoldCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/FoldCodeBlockControlModule";
import { ToolCallStepControlModule } from "@/controls/modules/canvas/tool/ToolCallStepControlModule";

// Define the application's specific control module registration order HERE
const controlModulesToRegister: ControlModuleConstructor[] = [
  UrlParameterControlModule,
  GeneralSettingsModule,
  ThemeSettingsControlModule,
  ProviderSettingsModule,
  AssistantSettingsModule,
  DataSettingsModule,
  ModSettingsModule,
  ConversationListControlModule,
  SidebarToggleControlModule,
  SettingsControlModule,
  ProjectSettingsControlModule,
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
  VfsToolsModule,
  GitToolsModule,
  // Canvas Action Controls
  CopyActionControlModule, // For InteractionCard header
  FoldInteractionControlModule, // For InteractionCard header
  RegenerateActionControlModule, // For InteractionCard footer
  RatingActionControlModule, // For InteractionCard footer
  CopyCodeBlockControlModule, // For CodeBlockRenderer header
  FoldCodeBlockControlModule, // For CodeBlockRenderer header
  ExampleCanvasControlModule,
  ToolCallStepControlModule,
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
