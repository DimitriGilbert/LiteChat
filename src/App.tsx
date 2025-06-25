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
import { ManualSyncSidebarControlModule } from "@/controls/modules/ManualSyncSidebarControlModule";
import { VfsToolsModule } from "@/controls/modules/VfsToolsModule";
import { GitToolsModule } from "@/controls/modules/GitToolsModule";
import { McpToolsModule } from "@/controls/modules/McpToolsModule";
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
import { ImageGenerationControlModule } from "@/controls/modules/ImageGenerationControlModule";
import { RacePromptControlModule } from "@/controls/modules/RacePromptControlModule";
import { ImprovePromptControlModule } from "@/controls/modules/ImprovePromptControlModule";
import { PromptLibraryControlModule } from "@/controls/modules/PromptLibraryControlModule";
import { AgentControlModule } from "@/controls/modules/AgentControlModule";
import { WorkflowControlModule } from "@/controls/modules/WorkflowControlModule";
import { WorkflowDisplayModule } from "@/controls/modules/WorkflowDisplayModule";


// Import new/updated Settings Modules
import { GeneralSettingsModule } from "@/controls/modules/GeneralSettingsModule";
import { ThemeSettingsControlModule } from "@/controls/modules/ThemeSettingsControlModule";
import { ProviderSettingsModule } from "@/controls/modules/ProviderSettingsModule";
import { AssistantSettingsModule } from "@/controls/modules/AssistantSettingsModule";
import { RunnableBlocksSettingsModule } from "@/controls/modules/RunnableBlocksSettingsModule";
import { DataSettingsModule } from "@/controls/modules/DataSettingsModule";
import { ModSettingsModule } from "@/controls/modules/ModSettingsModule";

// Import canvas action control modules
import { CopyActionControlModule } from "@/controls/modules/canvas/CopyActionControlModule";
import { RegenerateActionControlModule } from "@/controls/modules/canvas/RegenerateActionControlModule";
import { RegenerateWithModelActionControlModule } from "@/controls/modules/canvas/RegenerateWithModelActionControlModule";
import { ForkActionControlModule } from "@/controls/modules/canvas/ForkActionControlModule";
import { ForkWithModelActionControlModule } from "@/controls/modules/canvas/ForkWithModelActionControlModule";
import { ForkCompactActionControlModule } from "@/controls/modules/canvas/ForkCompactActionControlModule";
import { RatingActionControlModule } from "@/controls/modules/canvas/RatingActionControlModule";
import { EditResponseControlModule } from "@/controls/modules/canvas/EditResponseControlModule";
import { EditCodeBlockControlModule } from "@/controls/modules/canvas/EditCodeBlockControlModule";
import { PromoteInteractionControlModule } from "@/controls/modules/canvas/PromoteInteractionControlModule";
import { TableOfContentsControlModule } from "@/controls/modules/canvas/TableOfContentsControlModule";
// import { ExampleCanvasControlModule } from "@/controls/modules/example";
import { FoldInteractionControlModule } from "@/controls/modules/canvas/interaction/FoldInteractionControlModule";
import { ZipDownloadControlModule } from "@/controls/modules/canvas/interaction/ZipDownloadControlModule";
import { CopyCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/CopyCodeBlockControlModule";
import { FoldCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/FoldCodeBlockControlModule";
import { DownloadCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/DownloadCodeBlockControlModule";
import { ToolCallStepControlModule } from "@/controls/modules/canvas/tool/ToolCallStepControlModule";

// Import block renderer modules
import { CodeBlockRendererModule } from "@/controls/modules/CodeBlockRendererModule";
import { MermaidBlockRendererModule } from "@/controls/modules/MermaidBlockRendererModule";
import { FlowBlockRendererModule } from "@/controls/modules/FlowBlockRendererModule";
import { FormedibleBlockRendererModule } from "@/controls/modules/FormedibleBlockRendererModule";
import { ChartBlockRendererModule } from "@/controls/modules/ChartBlockRendererModule";
import { JsRunnableBlockRendererModule } from "@/controls/modules/JsRunnableBlockRendererModule";
import { PythonRunnableBlockRendererModule } from "@/controls/modules/PythonRunnableBlockRendererModule";

// Define the application's specific control module registration order HERE
const controlModulesToRegister: ControlModuleConstructor[] = [
  UrlParameterControlModule,
  GeneralSettingsModule,
  ThemeSettingsControlModule,
  ProviderSettingsModule,
  AssistantSettingsModule,
  RunnableBlocksSettingsModule,
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
  ImageGenerationControlModule,
  FileControlModule,
  VfsControlModule,
  RulesControlModule,
  SystemPromptControlModule,
  ToolSelectorControlModule,
  ParameterControlModule,
  StructuredOutputControlModule,
  RacePromptControlModule,
  ImprovePromptControlModule,
  PromptLibraryControlModule,
  AgentControlModule,
  WorkflowControlModule,
  WorkflowDisplayModule,
  GitSyncControlModule,
  ManualSyncSidebarControlModule,
  VfsToolsModule,
  GitToolsModule,
  McpToolsModule,
  // Block Renderers (should be registered early)
  CodeBlockRendererModule,
  MermaidBlockRendererModule,
  FlowBlockRendererModule,
  FormedibleBlockRendererModule,
  ChartBlockRendererModule,
  JsRunnableBlockRendererModule,
  PythonRunnableBlockRendererModule,
  // Canvas Action Controls
  CopyActionControlModule, // For InteractionCard header
  FoldInteractionControlModule, // For InteractionCard header
  ZipDownloadControlModule, // For InteractionCard header
  TableOfContentsControlModule, // For InteractionCard header
  PromoteInteractionControlModule, // For InteractionCard header
  RegenerateActionControlModule, // For InteractionCard footer
  RegenerateWithModelActionControlModule, // For InteractionCard footer
  ForkActionControlModule, // For InteractionCard footer
  ForkWithModelActionControlModule, // For InteractionCard footer
  ForkCompactActionControlModule, // For InteractionCard footer
  EditResponseControlModule, // For InteractionCard footer
  RatingActionControlModule, // For InteractionCard footer
  CopyCodeBlockControlModule, // For CodeBlockRenderer header
  FoldCodeBlockControlModule, // For CodeBlockRenderer header
  DownloadCodeBlockControlModule, // For CodeBlockRenderer header
  EditCodeBlockControlModule, // For CodeBlockRenderer header
  // ExampleCanvasControlModule,
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
