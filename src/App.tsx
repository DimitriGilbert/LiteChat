// src/App.tsx
import { LiteChat, RegistrationFunction } from "@/components/LiteChat/LiteChat";
import { PrismThemeLoader } from "@/components/LiteChat/common/PrismThemeLoader";

// Import ALL registration functions needed by this specific App instance
import { registerConversationListControl } from "@/hooks/litechat/registerConversationListControl";
import { registerSettingsControl } from "@/hooks/litechat/registerSettingsControl";
import { registerSidebarToggleControl } from "@/hooks/litechat/registerSidebarToggleControl";
import { registerParameterControl } from "@/hooks/litechat/registerParameterControl";
import { registerFileControl } from "@/hooks/litechat/registerFileControl";
import { registerVfsControl } from "@/hooks/litechat/registerVfsControl";
import { registerGitSyncControl } from "@/hooks/litechat/registerGitSyncControl";
import { registerVfsTools } from "@/hooks/litechat/registerVfsTools";
import { registerGitTools } from "@/hooks/litechat/registerGitTools";
import { registerToolSelectorControl } from "@/hooks/litechat/registerToolSelectorControl";
import { registerProjectSettingsControl } from "@/hooks/litechat/registerProjectSettingsControl";
import { registerGlobalModelSelector } from "@/hooks/litechat/registerGlobalModelSelector";
import { registerSystemPromptControl } from "@/hooks/litechat/registerSystemPromptControl";
import { registerStructuredOutputControl } from "@/hooks/litechat/registerStructuredOutputControl";
import { registerUsageDisplayControl } from "@/hooks/litechat/registerUsageDisplayControl";
import { registerReasoningControl } from "@/hooks/litechat/registerReasoningControl";
import { registerWebSearchControl } from "@/hooks/litechat/registerWebSearchControl";
import { registerRulesControl } from "@/hooks/litechat/registerRulesControl";
import { registerAutoTitleControl } from "@/hooks/litechat/registerAutoTitleControl";

// Define the application's specific registration order HERE
const controlsToRegister: RegistrationFunction[] = [
  // Layout Controls (Sidebar, Header, Footer)
  registerConversationListControl,
  registerSidebarToggleControl,
  registerSettingsControl,
  registerProjectSettingsControl, // Modal, order less critical

  // Prompt Controls (Order matters for visual layout)
  registerGlobalModelSelector,
  registerAutoTitleControl,
  registerUsageDisplayControl,
  registerReasoningControl,
  registerWebSearchControl,
  registerFileControl,
  registerVfsControl,
  registerRulesControl,
  registerSystemPromptControl,
  registerToolSelectorControl,
  registerParameterControl,
  registerStructuredOutputControl,
  registerGitSyncControl,

  // Tools (Registration order doesn't affect UI directly)
  registerVfsTools,
  registerGitTools,
];

function App() {
  return (
    <>
      {/* Render the theme loader outside LiteChat */}
      <PrismThemeLoader />
      <div className="h-screen bg-background text-foreground flex flex-col">
        <main className="flex-grow overflow-hidden">
          {/* Pass the registration functions array using the 'controls' prop */}
          <LiteChat controls={controlsToRegister} />
        </main>
      </div>
    </>
  );
}
export default App;
