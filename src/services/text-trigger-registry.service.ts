// src/services/text-trigger-registry.service.ts
import type { TriggerNamespace } from '@/types/litechat/text-triggers';

class TextTriggerRegistryService {
  private registeredNamespaces: Map<string, TriggerNamespace> = new Map();

  registerNamespace(namespace: TriggerNamespace): void {
    this.registeredNamespaces.set(namespace.id, namespace);
  }

  unregisterNamespace(namespaceId: string): void {
    this.registeredNamespaces.delete(namespaceId);
  }

  getRegisteredNamespaces(): TriggerNamespace[] {
    return Array.from(this.registeredNamespaces.values());
  }

  getNamespace(id: string): TriggerNamespace | undefined {
    return this.registeredNamespaces.get(id);
  }

  clear(): void {
    this.registeredNamespaces.clear();
  }
}

// Export singleton instance
export const textTriggerRegistry = new TextTriggerRegistryService();