// src/services/config-sync.service.ts

import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { normalizePath, joinPath } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import type { fs as FsType } from "@zenfs/core";
import { useSettingsStore } from "@/store/settings.store";
import { PersistenceService } from "@/services/persistence.service";

const CONFIG_DIR = ".litechat/config";
const SYNC_REPO_BASE_DIR = "/synced_repos";
const CONFIG_FILE = "litechat-config.json";

export interface ConfigData {
  settings: any;
  rules: any[];
  promptTemplates: any[];
  agents: any[];
  workflows: any[];
  mcpServers: any[];
  exportedAt: string;
  version: string;
}

/**
 * Service for syncing LiteChat configuration with Git repositories
 */
export class ConfigSyncService {
  private static instance: ConfigSyncService;

  public static getInstance(): ConfigSyncService {
    if (!ConfigSyncService.instance) {
      ConfigSyncService.instance = new ConfigSyncService();
    }
    return ConfigSyncService.instance;
  }

  /**
   * Sync configuration with the linked Git repository
   */
  async syncConfiguration(
    fsInstance: typeof FsType,
    repo: SyncRepo,
    setConfigStatus: (status: SyncStatus, error?: string | null) => void,
    silent = false
  ): Promise<void> {
    setConfigStatus("syncing");
    const repoDir = normalizePath(`${SYNC_REPO_BASE_DIR}/${repo.id}`);
    const configFilePath = joinPath(repoDir, CONFIG_DIR, CONFIG_FILE);
    const credentials = { username: repo.username || '', password: repo.password || '' };
    const branchToUse = repo.branch || "main";

    try {
      // Ensure repository exists locally
      try {
        await fsInstance.promises.stat(joinPath(repoDir, ".git"));
      } catch (e: any) {
        if (e.code === "ENOENT") {
          toast.error(
            `Repository "${repo.name}" not found locally. Please clone/sync it from Settings first.`
          );
          setConfigStatus("error", "Repo not cloned");
          return;
        }
        throw e;
      }

      if (!silent) toast.info(`Pulling latest config changes for "${repo.name}"...`);
      await VfsOps.gitPullOp(repoDir, branchToUse, credentials, { fsInstance });

      // Try to read remote config
      let remoteConfigData: ConfigData | null = null;
      let remoteTimestamp: number | null = null;
      
      try {
        const fileContent = await VfsOps.readFileOp(configFilePath, { fsInstance, silent: true });
        const jsonString = new TextDecoder().decode(fileContent);
        remoteConfigData = JSON.parse(jsonString);
        remoteTimestamp = remoteConfigData?.exportedAt 
          ? new Date(remoteConfigData.exportedAt).getTime()
          : null;
        if (isNaN(remoteTimestamp ?? NaN)) remoteTimestamp = null;
      } catch (e: any) {
        if (e.code === "ENOENT" || e.message?.includes("No such file")) {
          // console.log(`Config file ${configFilePath} not found in repo. This is the first sync - will push local version.`);
        } else {
          console.error(`Failed to read or parse remote config file: ${e.message}`);
          toast.warning(`Could not read remote config: ${e.message}`);
        }
      }

      // console.log("About to get local config...");
      // Get current local config
      const localConfigData = await this.exportCurrentConfig();
      // console.log("Got local config, getting timestamps...");
      const localTimestamp = new Date(localConfigData.exportedAt).getTime();

      // Get last sync timestamp from settings
      const lastSyncTimestamp = this.getLastConfigSyncTimestamp();

      // Determine sync direction
      // console.log("Sync decision:", {
      //   hasRemoteConfig: !!remoteConfigData,
      //   localTimestamp,
      //   remoteTimestamp,
      //   lastSyncTimestamp,
      //   willPush: !remoteConfigData ||
      //     localTimestamp > (remoteTimestamp ?? 0) ||
      //     (localTimestamp > lastSyncTimestamp && localTimestamp >= (remoteTimestamp ?? 0))
      // });
      
      if (
        !remoteConfigData ||
        localTimestamp > (remoteTimestamp ?? 0) ||
        (localTimestamp > lastSyncTimestamp && localTimestamp >= (remoteTimestamp ?? 0))
      ) {
        // Push local config to remote
        // console.log("Pushing local config to remote...");
        if (!silent) toast.info("Local config changes detected. Pushing to remote...");
        
        await this.pushConfigToRemote(
          fsInstance,
          repoDir,
          configFilePath,
          localConfigData,
          branchToUse,
          credentials
        );

        this.updateLastConfigSyncTimestamp();
        setConfigStatus("idle");
        // console.log("Config push completed successfully");
        if (!silent) toast.success("Configuration synced successfully (pushed).");

      } else if (remoteTimestamp && remoteTimestamp > localTimestamp) {
        // Pull remote config to local
        if (!silent) toast.info("Remote config changes detected. Updating local configuration...");
        
        await this.importRemoteConfig(remoteConfigData!);
        this.updateLastConfigSyncTimestamp();
        setConfigStatus("idle");
        if (!silent) toast.success("Configuration synced successfully (pulled).");

      } else {
        // Already up-to-date
        if (!silent) toast.info("Configuration already up-to-date.");
        this.updateLastConfigSyncTimestamp();
        setConfigStatus("idle");
      }

    } catch (error: any) {
      console.error(`Config sync failed:`, error);
      setConfigStatus("error", error.message);
      emitter.emit('config-sync:sync-failed', { error: error.message });
    }
  }

  /**
   * Export current configuration to ConfigData format
   */
  private async exportCurrentConfig(): Promise<ConfigData> {
    // Use existing export functionality
    const exportData = await PersistenceService.getAllDataForExport({
      importSettings: true,
      importRulesAndTags: true,
      importPromptTemplates: true,
      importAgents: true,
      importWorkflows: true,
      importMcpServers: true,
      importApiKeys: false, // Don't sync API keys for security
      importProviderConfigs: false, // Don't sync provider configs
      importProjects: false, // Don't sync projects
      importConversations: false, // Don't sync conversations
      importSyncRepos: false, // Don't sync repo configs
      importMods: false, // Don't sync mods
    });

    // Convert to ConfigData format
    const configData: ConfigData = {
      settings: exportData.settings || {},
      rules: exportData.rules || [],
      promptTemplates: exportData.promptTemplates || [],
      agents: exportData.agents || [],
      workflows: exportData.workflows || [],
      mcpServers: exportData.mcpServers || [],
      exportedAt: exportData.exportedAt,
      version: exportData.version.toString()
    };

    return configData;
  }

  /**
   * Import remote configuration into local stores
   */
  private async importRemoteConfig(remoteConfig: ConfigData): Promise<void> {
    // Import settings
    if (remoteConfig.settings) {
      emitter.emit('config-sync:import-settings', { settings: remoteConfig.settings });
    }

    // Import rules
    if (remoteConfig.rules && remoteConfig.rules.length > 0) {
      emitter.emit('config-sync:import-rules', { rules: remoteConfig.rules });
    }

    // Import prompt templates
    if (remoteConfig.promptTemplates && remoteConfig.promptTemplates.length > 0) {
      emitter.emit('config-sync:import-prompt-templates', { 
        templates: remoteConfig.promptTemplates 
      });
    }

    // Import agents
    if (remoteConfig.agents && remoteConfig.agents.length > 0) {
      emitter.emit('config-sync:import-agents', { agents: remoteConfig.agents });
    }

    // Import workflows
    if (remoteConfig.workflows && remoteConfig.workflows.length > 0) {
      emitter.emit('config-sync:import-workflows', { workflows: remoteConfig.workflows });
    }

    // Import MCP servers
    if (remoteConfig.mcpServers && remoteConfig.mcpServers.length > 0) {
      emitter.emit('config-sync:import-mcp-servers', { servers: remoteConfig.mcpServers });
    }

    emitter.emit('config-sync:import-completed', { config: remoteConfig });
  }

  /**
   * Push local config to remote repository
   */
  private async pushConfigToRemote(
    fsInstance: typeof FsType,
    repoDir: string,
    configFilePath: string,
    configData: ConfigData,
    branchToUse: string,
    credentials: { username: string; password: string }
  ): Promise<void> {
    // Ensure config directory exists
    const configDir = joinPath(repoDir, CONFIG_DIR);
    try {
      await VfsOps.createDirectoryOp(configDir, { fsInstance });
    } catch (e: any) {
      if (e.code !== "EEXIST") throw e;
    }

    // Write config file
    const configJson = JSON.stringify(configData, null, 2);
    await VfsOps.writeFileOp(configFilePath, configJson, { fsInstance });

    // Commit and push
    await VfsOps.gitCommitOp(
      repoDir,
      `Sync LiteChat configuration (${configData.exportedAt})`,
      { fsInstance }
    );
    await VfsOps.gitPushOp(repoDir, branchToUse, credentials, { fsInstance });

    emitter.emit('config-sync:push-completed', { config: configData });
  }

  /**
   * Get last config sync timestamp from settings
   */
  private getLastConfigSyncTimestamp(): number {
    const timestamp = useSettingsStore.getState().configSyncLastSyncedAt;
    return timestamp ? new Date(timestamp).getTime() : 0;
  }

  /**
   * Update last config sync timestamp in settings
   */
  private updateLastConfigSyncTimestamp(): void {
    useSettingsStore.getState().setConfigSyncLastSyncedAt(new Date().toISOString());
  }

  /**
   * Export configuration to file (for manual export)
   */
  async exportConfigToFile(): Promise<ConfigData> {
    const configData = await this.exportCurrentConfig();
    emitter.emit('config-sync:export-completed', { config: configData });
    return configData;
  }

  /**
   * Import configuration from file (for manual import)
   */
  async importConfigFromFile(configData: ConfigData): Promise<void> {
    await this.importRemoteConfig(configData);
  }
}

export const configSyncService = ConfigSyncService.getInstance();