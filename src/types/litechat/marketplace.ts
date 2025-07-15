// src/types/litechat/marketplace.ts
import type { DbRule } from './rules';
import type { PromptTemplate } from './prompt-template';
import type { WorkflowTemplate } from './workflow';
import type { McpServerConfig } from '@/store/mcp.store';

export type MarketplaceItemType = "rule" | "template" | "agent" | "workflow" | "mcp-server" | "config-bundle";

export interface MarketplaceIndex {
  name: string;
  description: string;
  version: string;
  lastUpdated: Date;
  author?: string;
  website?: string;
  items: MarketplaceItem[];
}

export interface MarketplaceItem {
  id: string;
  name: string;
  type: MarketplaceItemType;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  category?: string;
  downloadUrl: string;        // URL to the actual package file
  previewUrl?: string;        // URL to preview/readme
  dependencies?: string[];    // Other marketplace item IDs
  requiredLiteChatVersion?: string;
  fileSize?: number;
  downloadCount?: number;
  rating?: number;
  lastUpdated: Date;
  sourceId?: string;          // Set when loaded from a source
}

export interface MarketplaceSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: Date;
  lastRefreshed?: Date;
}

export interface MarketplacePackage {
  metadata: MarketplaceItem;
  content: MarketplacePackageContent;
}

export interface MarketplacePackageContent {
  rules?: DbRule[];
  promptTemplates?: PromptTemplate[];
  agents?: PromptTemplate[]; // Agents are stored as PromptTemplate with type="agent"
  workflows?: WorkflowTemplate[];
  mcpServers?: McpServerConfig[];
  settings?: Record<string, unknown>;
}

export interface InstalledMarketplaceItem {
  packageId: string;
  sourceId: string;
  installedAt: Date;
  version: string;
  enabled: boolean;
  // Track which specific items were installed
  installedRules: string[];
  installedTemplates: string[];
  installedMcpServers: string[];
}

export interface ConfigExportData {
  settings?: Record<string, unknown>;
  providers?: Record<string, unknown>[];
  rules?: DbRule[];
  promptTemplates?: PromptTemplate[];
  agents?: PromptTemplate[]; // Agents are stored as PromptTemplate with type="agent"
  workflows?: WorkflowTemplate[];
  mcpServers?: McpServerConfig[];
  exportedAt: Date;
  version: string;
}

export interface MarketplaceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MarketplaceCacheEntry {
  url: string;
  index: MarketplaceIndex;
  cachedAt: Date;
  expiresAt: Date;
}

// Database types
export interface DbMarketplaceSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: Date;
  lastRefreshed?: Date;
}

export interface DbMarketplaceIndex {
  id: string;
  sourceId: string;
  indexData: string; // JSON stringified MarketplaceIndex
  cachedAt: Date;
  expiresAt: Date;
}

export interface DbInstalledMarketplaceItem {
  id: string;
  packageId: string;
  sourceId: string;
  installedAt: Date;
  version: string;
  enabled: boolean;
  installedRules: string; // JSON stringified string[]
  installedTemplates: string; // JSON stringified string[]
  installedMcpServers: string; // JSON stringified string[]
  packageData: string; // JSON stringified MarketplacePackage
}