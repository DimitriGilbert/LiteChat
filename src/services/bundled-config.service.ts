import { BUNDLED_USER_CONFIG } from "virtual:user-config";
import { ImportExportService, type FullImportOptions } from "./import-export.service";
import { toast } from "sonner";

export interface BundledConfigOptions {
  importSettings?: boolean;
  importApiKeys?: boolean;
  importProviderConfigs?: boolean;
  importProjects?: boolean;
  importConversations?: boolean;
  importRulesAndTags?: boolean;
  importMods?: boolean;
  importSyncRepos?: boolean;
}

export class BundledConfigService {
  /**
   * Apply bundled user configuration if available
   * This should be called early in the application initialization
   */
  static async applyBundledConfig(options?: BundledConfigOptions): Promise<void> {
    if (!BUNDLED_USER_CONFIG) {
      console.log("[BundledConfig] No bundled user configuration found, skipping...");
      return;
    }

    try {
      console.log("[BundledConfig] Applying bundled user configuration...");
      
      // Default options - import everything except conversations to avoid overwriting user data
      const defaultOptions: FullImportOptions = {
        importSettings: true,
        importApiKeys: true,
        importProviderConfigs: true,
        importProjects: true,
        importConversations: false, // Don't overwrite user conversations by default
        importRulesAndTags: true,
        importMods: true,
        importSyncRepos: true,
        importMcpServers: true,
        importPromptTemplates: true,
        importAgents: true,
        importWorkflows: true,
        ...options
      };

      // Create a temporary file-like object for the import service
      const configBlob = new Blob([JSON.stringify(BUNDLED_USER_CONFIG)], { 
        type: "application/json" 
      });
      const configFile = new File([configBlob], "bundled-config.json", { 
        type: "application/json" 
      });

      await ImportExportService.importFullConfiguration(configFile, defaultOptions);
      
      console.log("[BundledConfig] ✅ Bundled user configuration applied successfully");
      toast.success("Bundled configuration loaded");
      
    } catch (error) {
      console.error("[BundledConfig] ❌ Error applying bundled user configuration:", error);
      toast.error(
        `Failed to apply bundled configuration: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't throw - let the app continue with default configuration
    }
  }

  /**
   * Check if bundled configuration is available
   */
  static hasBundledConfig(): boolean {
    return BUNDLED_USER_CONFIG !== null;
  }

  /**
   * Get the bundled configuration data (for inspection)
   */
  static getBundledConfig(): any | null {
    return BUNDLED_USER_CONFIG;
  }
} 