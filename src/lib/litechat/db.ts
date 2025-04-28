// src/lib/litechat/db.ts
import Dexie, { type Table } from "dexie";
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { DbMod } from "@/types/litechat/modding";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import type { SyncRepo } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import { normalizePath } from "./file-manager-utils"; // Import normalizePath

export interface DbAppState {
  key: string;
  value: any;
}

// Helper function to build project path during migration
// async function buildProjectPath(
//   projectId: string,
//   projectTable: Table<Project, string>,
// ): Promise<string> {
//   const project = await projectTable.get(projectId);
//   if (!project) return "/"; // Should not happen in migration context

//   if (!project.parentId) {
//     return normalizePath(`/${project.name}`);
//   }

//   const parentPath = await buildProjectPath(project.parentId, projectTable);
//   return normalizePath(`${parentPath}/${project.name}`);
// }

export class LiteChatDatabase extends Dexie {
  conversations!: Table<Conversation, string>;
  interactions!: Table<Interaction, string>;
  mods!: Table<DbMod, string>;
  appState!: Table<DbAppState, string>;
  providerConfigs!: Table<DbProviderConfig, string>;
  apiKeys!: Table<DbApiKey, string>;
  syncRepos!: Table<SyncRepo, string>;
  projects!: Table<Project, string>;

  constructor() {
    super("LiteChatDatabase_Rewrite_v1");
    this.version(5) // Bump version for project path schema
      .stores({
        conversations:
          "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
        interactions:
          "++id, conversationId, index, type, status, startedAt, parentId",
        mods: "++id, &name, enabled, loadOrder",
        appState: "&key",
        providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
        apiKeys: "++id, &name",
        syncRepos: "++id, &name, remoteUrl",
        // Removed name index, added unique path index
        projects: "++id, &path, parentId, createdAt, updatedAt, name",
      })
      .upgrade(async (tx) => {
        console.log(
          "Upgrading DB to version 5, adding unique path to projects.",
        );
        // Calculate and add path for existing projects
        const projectTable = tx.table("projects");
        const allProjects = await projectTable.toArray();
        const updates: Promise<any>[] = [];

        // Build a map for quick parent lookup during path construction
        const projectMap = new Map(allProjects.map((p) => [p.id, p]));

        const getPath = (proj: Project, map: Map<string, Project>): string => {
          if (!proj.parentId) {
            return normalizePath(`/${proj.name}`);
          }
          const parent = map.get(proj.parentId);
          if (!parent) {
            console.error(
              `Upgrade Error: Parent project ${proj.parentId} not found for project ${proj.id}. Defaulting path.`,
            );
            // Fallback path if parent is missing (shouldn't happen in consistent DB)
            return normalizePath(`/__ORPHANED__/${proj.name}`);
          }
          const parentPath = getPath(parent, map); // Recursive call
          return normalizePath(`${parentPath}/${proj.name}`);
        };

        for (const project of allProjects) {
          if (!project.path) {
            // Only update if path doesn't exist
            const calculatedPath = getPath(project, projectMap);
            updates.push(
              projectTable.update(project.id, { path: calculatedPath }),
            );
          }
        }
        await Promise.all(updates);
        console.log(`Updated paths for ${updates.length} projects.`);
      });
    // Define previous versions explicitly for Dexie's upgrade path
    this.version(4).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
      projects: "++id, name, parentId, createdAt, updatedAt", // Schema before path
    });
    this.version(3).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt, projectId",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
      projects: "++id, &name, parentId, createdAt, updatedAt",
    });
    this.version(2).stores({
      conversations:
        "++id, title, createdAt, updatedAt, syncRepoId, lastSyncedAt",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
      syncRepos: "++id, &name, remoteUrl",
    });
    this.version(1).stores({
      conversations: "++id, title, createdAt, updatedAt",
      interactions:
        "++id, conversationId, index, type, status, startedAt, parentId",
      mods: "++id, &name, enabled, loadOrder",
      appState: "&key",
      providerConfigs: "++id, &name, type, isEnabled, apiKeyId",
      apiKeys: "++id, &name",
    });
  }
}
export const db = new LiteChatDatabase();
