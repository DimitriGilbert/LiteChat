// src/services/import-export.service.ts
// FULL FILE
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { Project } from "@/types/litechat/project";
import {
  PersistenceService,
  type FullExportData,
} from "@/services/persistence.service";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import { format } from "date-fns";
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";

// Structure for project export
interface ProjectExportNode {
  project: Project;
  children: (ProjectExportNode | ConversationExportNode)[];
}

interface ConversationExportNode {
  conversation: Conversation;
  interactions: Interaction[];
}

// Helper function to trigger browser download
const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Helper function to format interactions to Markdown
const formatInteractionsToMarkdown = (
  conversation: Conversation,
  interactions: Interaction[],
): string => {
  let mdString = `# ${conversation.title}

`;
  mdString += `*Conversation ID: ${conversation.id}*
`;
  mdString += `*Created: ${format(conversation.createdAt, "yyyy-MM-dd HH:mm:ss")}*
`;
  mdString += `*Last Updated: ${format(conversation.updatedAt, "yyyy-MM-dd HH:mm:ss")}*
`;
  if (conversation.projectId) {
    mdString += `*Project ID: ${conversation.projectId}*
`;
  }
  mdString += `
---

`;

  interactions
    .filter((i) => i.type === "message.user_assistant")
    .sort((a, b) => a.index - b.index)
    .forEach((interaction) => {
      if (
        interaction.prompt?.content ||
        interaction.prompt?.metadata?.attachedFiles?.length
      ) {
        mdString += `## User (Index: ${interaction.index})

`;
        if (
          interaction.prompt.metadata?.attachedFiles &&
          interaction.prompt.metadata.attachedFiles.length > 0
        ) {
          mdString += `**Attached Files:**
`;
          interaction.prompt.metadata.attachedFiles.forEach((f: any) => {
            mdString += `- ${f.name} (${f.type}, ${formatBytes(f.size)}) ${f.source === "vfs" ? `(VFS: ${f.path})` : "(Direct Upload)"}
`;
          });
          mdString += `
`;
        }
        if (interaction.prompt.content) {
          mdString += `${interaction.prompt.content}

`;
        }
      }
      if (interaction.response) {
        mdString += `## Assistant (Index: ${interaction.index})

`;
        if (interaction.metadata?.modelId) {
          mdString += `*Model: ${interaction.metadata.modelId}*

`;
        }
        if (typeof interaction.response === "string") {
          mdString += `${interaction.response}

`;
        } else {
          mdString += `\`\`\`json
`;
          mdString += `${JSON.stringify(interaction.response, null, 2)}
`;
          mdString += `\`\`\`

`;
        }
        if (
          interaction.metadata?.promptTokens ||
          interaction.metadata?.completionTokens
        ) {
          mdString += `*Tokens: ${interaction.metadata.promptTokens ?? "?"} (prompt) / ${interaction.metadata.completionTokens ?? "?"} (completion)*

`;
        }
      }
      mdString += `---

`;
    });

  return mdString;
};

// Options for full import/export
export interface FullImportOptions {
  importSettings: boolean;
  importApiKeys: boolean;
  importProviderConfigs: boolean;
  importProjects: boolean;
  importConversations: boolean;
  importRulesAndTags: boolean;
  importMods: boolean;
  importSyncRepos: boolean;
  importMcpServers: boolean;
  importPromptTemplates: boolean;
  importAgents: boolean;
  importWorkflows: boolean;
}
export type FullExportOptions = FullImportOptions;

export class ImportExportService {
  static async importConversation(
    file: File,
    addConversationAction: (
      conversationData: Partial<Omit<Conversation, "id" | "createdAt">> & {
        title: string;
        projectId?: string | null;
      },
    ) => Promise<string>,
    selectItemAction: (
      id: string | null,
      type: "conversation" | "project" | null,
    ) => Promise<void>,
  ): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (
        !data ||
        typeof data !== "object" ||
        !data.conversation ||
        !Array.isArray(data.interactions)
      ) {
        throw new Error(
          "Invalid import file format. Expected { conversation: {}, interactions: [] }.",
        );
      }
      const importedConversation: Conversation = data.conversation;
      const importedInteractions: Interaction[] = data.interactions;
      if (
        !importedConversation.id ||
        !importedConversation.title ||
        !importedConversation.createdAt ||
        !importedConversation.updatedAt
      ) {
        throw new Error("Invalid conversation data in import file.");
      }
      const newId = await addConversationAction({
        title: importedConversation.title || "Imported Chat",
        metadata: importedConversation.metadata,
        projectId: null,
        syncRepoId: null,
        lastSyncedAt: null,
      });
      const interactionPromises = importedInteractions.map((i) =>
        PersistenceService.saveInteraction({
          ...i,
          conversationId: newId,
          id: nanoid(),
        }),
      );
      await Promise.all(interactionPromises);
      await selectItemAction(newId, "conversation");
      toast.success("Conversation imported successfully.");
    } catch (error) {
      console.error("ImportExportService: Error importing conversation", error);
      toast.error(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportConversation(
    conversationId: string,
    format: "json" | "md",
  ): Promise<void> {
    try {
      const conversation = useConversationStore
        .getState()
        .getConversationById(conversationId);
      if (!conversation) {
        throw new Error("Conversation not found.");
      }
      const interactions =
        await PersistenceService.loadInteractionsForConversation(
          conversationId,
        );
      let blob: Blob;
      let filename: string;
      const safeTitle =
        conversation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() ||
        "conversation";
      if (format === "json") {
        const exportData = { conversation, interactions };
        const jsonString = JSON.stringify(exportData, null, 2);
        blob = new Blob([jsonString], { type: "application/json" });
        filename = `litechat_conversation_${safeTitle}_${conversationId.substring(0, 6)}.json`;
      } else if (format === "md") {
        const mdString = formatInteractionsToMarkdown(
          conversation,
          interactions,
        );
        blob = new Blob([mdString], { type: "text/markdown" });
        filename = `litechat_conversation_${safeTitle}_${conversationId.substring(0, 6)}.md`;
      } else {
        throw new Error("Invalid export format specified.");
      }
      triggerDownload(blob, filename);
      toast.success(`Conversation exported as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error("ImportExportService: Error exporting conversation", error);
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportProject(projectId: string): Promise<void> {
    try {
      const { projects, getProjectById } = useProjectStore.getState();
      const { conversations } = useConversationStore.getState();

      const rootProject = getProjectById(projectId);
      if (!rootProject) {
        throw new Error("Project not found.");
      }

      const buildExportTree = async (
        currentProjectId: string,
      ): Promise<ProjectExportNode> => {
        const project = projects.find(
          (p: Project) => p.id === currentProjectId,
        );
        if (!project) {
          throw new Error(`Project ${currentProjectId} not found in state.`);
        }

        const childProjects = projects.filter(
          (p: Project) => p.parentId === currentProjectId,
        );
        const childConversations = conversations.filter(
          (c: Conversation) => c.projectId === currentProjectId,
        );

        const children: (ProjectExportNode | ConversationExportNode)[] = [];

        for (const childProj of childProjects) {
          children.push(await buildExportTree(childProj.id));
        }

        for (const childConvo of childConversations) {
          const interactions =
            await PersistenceService.loadInteractionsForConversation(
              childConvo.id,
            );
          children.push({
            conversation: childConvo,
            interactions: interactions,
          });
        }

        return {
          project: project,
          children: children,
        };
      };

      const exportData = await buildExportTree(projectId);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const safeName =
        rootProject.name.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "project";
      const filename = `litechat_project_${safeName}_${projectId.substring(0, 6)}.json`;

      triggerDownload(blob, filename);
      toast.success(`Project "${rootProject.name}" exported.`);
    } catch (error) {
      console.error("ImportExportService: Error exporting project", error);
      toast.error(
        `Project export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportAllConversations(): Promise<void> {
    try {
      const conversations = useConversationStore.getState().conversations;
      const exportData = [];
      for (const convo of conversations) {
        const interactions =
          await PersistenceService.loadInteractionsForConversation(convo.id);
        exportData.push({ conversation: convo, interactions });
      }
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const filename = `litechat_all_conversations_export_${new Date().toISOString().split("T")[0]}.json`;
      triggerDownload(blob, filename);
      toast.success("All conversations exported.");
    } catch (error) {
      console.error(
        "ImportExportService: Error exporting conversations",
        error,
      );
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  // --- Full Config Export/Import ---
  static async exportFullConfiguration(
    options: FullExportOptions,
  ): Promise<void> {
    try {
      const exportData = await PersistenceService.getAllDataForExport(options);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
      const filename = `litechat_full_config_${timestamp}.json`;
      triggerDownload(blob, filename);
      toast.success("Full configuration exported successfully.");
    } catch (error) {
      console.error(
        "ImportExportService: Error exporting full configuration",
        error,
      );
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportPromptTemplates(): Promise<void> {
    try {
      const templates = await PersistenceService.loadPromptTemplates();
      const regularTemplates = templates.filter(t => !t.type || t.type === "prompt");
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        promptTemplates: regularTemplates,
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
      const filename = `litechat_prompt_templates_${timestamp}.json`;
      
      triggerDownload(blob, filename);
      toast.success(`Exported ${regularTemplates.length} prompt templates.`);
    } catch (error) {
      console.error("ImportExportService: Error exporting prompt templates", error);
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportAgents(): Promise<void> {
    try {
      const templates = await PersistenceService.loadPromptTemplates();
      const agents = templates.filter(t => t.type === "agent");
      const agentIds = agents.map(a => a.id);
      const tasks = templates.filter(t => t.type === "task" && t.parentId && agentIds.includes(t.parentId));
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        agents: [...agents, ...tasks],
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
      const filename = `litechat_agents_${timestamp}.json`;
      
      triggerDownload(blob, filename);
      toast.success(`Exported ${agents.length} agents with ${tasks.length} tasks.`);
    } catch (error) {
      console.error("ImportExportService: Error exporting agents", error);
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportMcpServers(): Promise<void> {
    try {
      const mcpServers = await PersistenceService.loadSetting("mcpServers", []);
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        mcpServers,
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
      const filename = `litechat_mcp_servers_${timestamp}.json`;
      
      triggerDownload(blob, filename);
      toast.success(`Exported ${mcpServers.length} MCP server configurations.`);
    } catch (error) {
      console.error("ImportExportService: Error exporting MCP servers", error);
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async importFullConfiguration(
    file: File,
    options: FullImportOptions,
  ): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as FullExportData;

      if (!data || typeof data !== "object" || !data.version) {
        throw new Error(
          "Invalid import file format. Missing version or basic structure.",
        );
      }

      // Add more validation as needed based on FullExportData structure

      await PersistenceService.importAllData(data, options);

      toast.success(
        "Configuration imported successfully. Reloading application...",
      );
      // Reload the application to apply changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error(
        "ImportExportService: Error importing full configuration",
        error,
      );
      toast.error(
        `Full import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async importPromptTemplates(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data || typeof data !== "object" || !data.promptTemplates || !Array.isArray(data.promptTemplates)) {
        throw new Error("Invalid prompt templates file format.");
      }
      
      let importedCount = 0;
      for (const template of data.promptTemplates) {
        try {
          await PersistenceService.savePromptTemplate({
            ...template,
            id: template.id || nanoid(), // Generate new ID if missing
            createdAt: template.createdAt ? new Date(template.createdAt) : new Date(),
            updatedAt: new Date(),
          });
          importedCount++;
        } catch (error) {
          console.warn(`Failed to import template ${template.name}:`, error);
        }
      }
      
      toast.success(`Imported ${importedCount} prompt templates.`);
    } catch (error) {
      console.error("ImportExportService: Error importing prompt templates", error);
      toast.error(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async importAgents(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data || typeof data !== "object" || !data.agents || !Array.isArray(data.agents)) {
        throw new Error("Invalid agents file format.");
      }
      
      let importedAgents = 0;
      let importedTasks = 0;
      
      for (const template of data.agents) {
        try {
          await PersistenceService.savePromptTemplate({
            ...template,
            id: template.id || nanoid(), // Generate new ID if missing
            createdAt: template.createdAt ? new Date(template.createdAt) : new Date(),
            updatedAt: new Date(),
          });
          
          if (template.type === "agent") {
            importedAgents++;
          } else if (template.type === "task") {
            importedTasks++;
          }
        } catch (error) {
          console.warn(`Failed to import ${template.type} ${template.name}:`, error);
        }
      }
      
      toast.success(`Imported ${importedAgents} agents with ${importedTasks} tasks.`);
    } catch (error) {
      console.error("ImportExportService: Error importing agents", error);
      toast.error(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async importMcpServers(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data || typeof data !== "object" || !data.mcpServers || !Array.isArray(data.mcpServers)) {
        throw new Error("Invalid MCP servers file format.");
      }
      
      await PersistenceService.saveSetting("mcpServers", data.mcpServers);
      toast.success(`Imported ${data.mcpServers.length} MCP server configurations.`);
    } catch (error) {
      console.error("ImportExportService: Error importing MCP servers", error);
      toast.error(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async exportWorkflows(): Promise<void> {
    try {
      const workflows = await PersistenceService.loadWorkflows();
      
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workflows,
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
      const filename = `litechat_workflows_${timestamp}.json`;
      
      triggerDownload(blob, filename);
      toast.success(`Exported ${workflows.length} workflows.`);
    } catch (error) {
      console.error("ImportExportService: Error exporting workflows", error);
      toast.error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  static async importWorkflows(file: File): Promise<void> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data || typeof data !== "object" || !data.workflows || !Array.isArray(data.workflows)) {
        throw new Error("Invalid workflows file format.");
      }
      
      let importedCount = 0;
      for (const workflow of data.workflows) {
        try {
          await PersistenceService.saveWorkflow({
            ...workflow,
            id: workflow.id || nanoid(), // Generate new ID if missing
            createdAt: workflow.createdAt ? workflow.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          importedCount++;
        } catch (error) {
          console.warn(`Failed to import workflow ${workflow.name}:`, error);
        }
      }
      
      toast.success(`Imported ${importedCount} workflows.`);
    } catch (error) {
      console.error("ImportExportService: Error importing workflows", error);
      toast.error(
        `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
  // --- End Full Config Export/Import ---
}
