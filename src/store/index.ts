// src/store/index.ts

// Export all store hooks for easy importing
export * from "./core-chat.store";
export * from "./provider.store";
export * from "./sidebar.store";
export * from "./settings.store";
export * from "./vfs.store";
export * from "./mod.store";
export * from "./input.store";

// You might also define combined selectors here if needed,
// though it's often cleaner to define them where they are used.
// Example:
// import { useSettingsStore } from './settings.store';
// import { useSidebarStore } from './sidebar.store';
// import type { ConversationSidebarItem } from '@/lib/types';
//
// export const useActiveSystemPrompt = (): string | null => {
//   const globalPrompt = useSettingsStore((state) => state.globalSystemPrompt);
//   const selectedItemId = useSidebarStore((state) => state.selectedItemId);
//   const selectedItemType = useSidebarStore((state) => state.selectedItemType);
//   const sidebarItems = useSidebarStore((state) => state.sidebarItems);
//
//   if (selectedItemType === 'conversation') {
//     const activeConv = sidebarItems.find(
//       (item) => item.id === selectedItemId && item.type === 'conversation'
//     ) as ConversationSidebarItem | undefined;
//     // Prioritize conversation-specific prompt if it's explicitly set (not null/undefined)
//     if (activeConv?.systemPrompt != null) {
//       return activeConv.systemPrompt;
//     }
//   }
//   // Fallback to global prompt
//   return globalPrompt;
// };
