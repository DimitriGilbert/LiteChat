// src/services/import-export.service.ts
// FULL FILE
import type { Conversation } from "@/types/litechat/chat";
import type { Interaction } from "@/types/litechat/interaction";
import type { Project } from "@/types/litechat/project";
import {
  PersistenceService,
  type FullExportData, // Import FullExportData type
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
}
export type FullExportOptions = FullImportOptions; // Alias for clarity

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
    options: FullExportOptions, // Accept export options
  ): Promise<void> {
    try {
      // Pass options to persistence service
      const exportData = await PersistenceService.getAllDataForExport(options);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const filename = `litechat_full_export_${new Date().toISOString().split("T")[0]}.json`;
      triggerDownload(blob, filename);
      toast.success("Full configuration exported successfully.");
    } catch (error) {
      console.error(
        "ImportExportService: Error exporting full configuration",
        error,
      );
      toast.error(
        `Full export failed: ${error instanceof Error ? error.message : String(error)}`,
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
      throw error; // Re-throw to indicate failure to the caller
    }
  }
  // --- End Full Config Export/Import ---
}
