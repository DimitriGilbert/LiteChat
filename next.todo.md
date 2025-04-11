# LiteChat Improvement & Refactor Roadmap

This document details a comprehensive plan to address the issues and feature requests you raised. Each task includes a description, rationale, and a list of all files likely to be affected. The plan is structured to allow LLM agents (or developers) to work incrementally and safely, minimizing risk of regressions.

---

## **A. Performance: Reduce Excessive Component Refresh (High CPU While Typing)**

### **Goal**
- Minimize unnecessary re-renders, especially during prompt typing, to reduce CPU usage.

### **Actions**
1. **Audit State Management**
   - Ensure prompt/attached files state is local to `PromptForm` and not propagated via context.
   - Avoid passing large/rapidly-changing state (like prompt) through context.

2. **Memoization**
   - Use `React.memo` and `useMemo` for components that do not need to re-render on every keystroke.
   - Audit `useChatContext` and `useCoreChatContext` consumers for unnecessary context usage.

3. **Optimize Context Value Construction**
   - Split context further if needed (e.g., separate prompt state from chat state).

4. **Throttle Expensive Effects**
   - Throttle or debounce any effects triggered by prompt changes.

### **Files to Review/Modify**
- `src/components/lite-chat/prompt-form.tsx`
- `src/components/lite-chat/prompt-input.tsx`
- `src/context/chat-context.tsx`
- `src/hooks/use-chat-context.ts`
- `src/hooks/use-chat-input.ts`
- Any component using `useChatContext` or `useCoreChatContext`
- `src/components/lite-chat/chat-content.tsx` (ensure message list is not re-rendering on prompt change)

---

## **B. VFS Per Project (Shared Among Project Chats) & Common VFS for Orphan Chats**

### **Goal**
- VFS should be shared among all chats within a project.
- Chats not in a project should share a single "orphan" VFS.

### **Actions**
1. **VFS Keying Logic**
   - Refactor VFS instantiation to use `projectId` as the key for project chats.
   - For orphan chats, use a special key (e.g., `"orphan"`).

2. **UI/UX**
   - Indicate in the UI when a chat is using a shared VFS.

3. **Migration**
   - Migrate existing VFS data if necessary.

### **Files to Review/Modify**
- `src/hooks/use-virtual-file-system.ts`
- `src/context/chat-context.tsx`
- `src/components/lite-chat/file-manager.tsx`
- `src/lib/types.ts` (if VFS context object needs new fields)
- `src/hooks/use-chat-storage.ts` (if VFS metadata is stored in DB)
- Any VFS-related UI (e.g., VFS toggle, settings)

---

## **C. Optional: Encrypted Storage with Password**

### **Goal**
- Allow users to encrypt VFS and/or API keys with a password.

### **Actions**
1. **Feasibility Study**
   - Research IndexedDB encryption libraries (e.g., [crypto-js](https://github.com/brix/crypto-js), [dexie-encrypted](https://github.com/dfahlander/Dexie.js/tree/master/addons/Dexie-encrypted)).

2. **Password Management**
   - UI for setting/unlocking password.
   - Store password in memory only (never persist).

3. **Encryption Layer**
   - Encrypt/decrypt VFS and API key data at rest.

4. **Error Handling**
   - Handle wrong password, password reset, etc.

### **Files to Review/Modify**
- `src/lib/db.ts`
- `src/hooks/use-chat-storage.ts`
- `src/context/chat-context.tsx`
- `src/components/lite-chat/settings-modal.tsx`
- `src/components/lite-chat/settings-data-management.tsx`
- Any VFS or API key management code

---

## **D. Global Error Boundary**

### **Goal**
- Catch unexpected React errors and display a user-friendly message.

### **Actions**
1. **Add Error Boundary Component**
   - Implement a top-level error boundary.

2. **Wrap Main App**
   - Wrap `<LiteChat>` or `<App>` with the error boundary.

### **Files to Review/Modify**
- `src/App.tsx`
- New file: `src/components/error-boundary.tsx`
- (Optional) `src/components/lite-chat/chat.tsx`

---

## **E. E2E Testing with Puppeteer/Playwright**

### **Goal**
- Replace or supplement unit tests with robust end-to-end (E2E) tests.

### **Actions**
1. **Setup E2E Test Framework**
   - Choose Puppeteer or Playwright.
   - Add scripts/configuration.

2. **Write E2E Scenarios**
   - Test chat flow, VFS, API key management, settings, etc.

3. **CI Integration**
   - Add E2E tests to CI pipeline.

### **Files to Add/Modify**
- `e2e/` (new directory for E2E tests)
- `package.json` (add scripts/deps)
- `.github/workflows/` or CI config
- Remove or mark `.notest.tsx` files as deprecated

---

## **F. Keyboard Shortcuts (Configurable, Non-Conflicting)**

### **Goal**
- Add keyboard shortcuts for common actions, with user override and no default conflicts.

### **Actions**
1. **Shortcut Registry**
   - Implement a registry for shortcuts with default and user-defined mappings.

2. **Settings UI**
   - Add a new "Shortcuts" tab in settings modal for user customization.

3. **Event Handling**
   - Listen for shortcuts at the app level, but avoid system/browser conflicts.

### **Files to Add/Modify**
- `src/components/lite-chat/settings-modal.tsx`
- New: `src/components/lite-chat/settings-shortcuts.tsx`
- `src/context/chat-context.tsx` (shortcut registry in context)
- `src/App.tsx` (global event listener)
- `src/lib/types.ts` (shortcut config types)

---

## **G. Message List UX Improvements**

### **Goal**
- Prevent forced scroll-to-bottom during streaming unless user is at bottom.
- Allow folding/unfolding of entire messages.
- Add codeblock headers with file type.

### **Actions**
1. **Scroll Behavior**
   - Only auto-scroll if user is at bottom when new message arrives.

2. **Message Folding**
   - Add fold/unfold action to message bubble.

3. **Codeblock Header**
   - Parse codeblocks for language/file type and display a header.

### **Files to Add/Modify**
- `src/components/lite-chat/chat-content.tsx`
- `src/components/lite-chat/message-bubble.tsx`
- `src/components/lite-chat/message-actions.tsx`
- `src/lib/types.ts` (if message folding state is tracked)

---

## **H. Plugin System (User-Provided Script or URL)**

### **Goal**
- Allow users to load plugins (JS scripts or URLs) to extend LiteChat.

### **Actions**
1. **Plugin Loader**
   - Implement safe dynamic import of user scripts/URLs.

2. **Plugin API**
   - Define a minimal API for plugins (e.g., register actions, tabs, etc.).

3. **Settings UI**
   - Add a "Plugins" tab in settings modal for managing plugins.

4. **Security**
   - Warn users about risks of third-party scripts.

### **Files to Add/Modify**
- New: `src/plugins/` (plugin loader, API)
- `src/context/chat-context.tsx` (plugin registration)
- `src/components/lite-chat/settings-modal.tsx`
- New: `src/components/lite-chat/settings-plugins.tsx`
- `src/lib/types.ts` (plugin types)

---

## **I. Increase Unit Test Coverage (Non-Mock, Realistic UI Tests)**

### **Goal**
- Add meaningful unit tests for untested logic, focusing on real user flows.

### **Actions**
1. **Identify Untested Areas**
   - Review `.notest.tsx` and other files for missing coverage.

2. **Write Tests**
   - Focus on hooks, context, and critical UI flows.
   - Avoid excessive mocking; use realistic data and flows.

3. **Refactor for Testability**
   - If needed, refactor code to make it more testable (e.g., dependency injection).

### **Files to Add/Modify**
- `src/test/components/lite-chat/` (convert `.notest.tsx` to `.test.tsx`)
- `src/test/hooks/`
- `src/hooks/` (if refactoring for testability)
- `src/context/`
- `src/components/lite-chat/`

---

# **Summary Table**

| Task | Description | Key Files |
|------|-------------|-----------|
| A | Performance: Reduce re-renders | `prompt-form.tsx`, `chat-context.tsx`, `use-chat-input.ts`, etc. |
| B | VFS per project/orphan | `use-virtual-file-system.ts`, `chat-context.tsx`, `file-manager.tsx` |
| C | Encryption (optional) | `db.ts`, `use-chat-storage.ts`, `settings-modal.tsx` |
| D | Error boundary | `App.tsx`, `error-boundary.tsx` |
| E | E2E tests | `e2e/`, `package.json`, `.notest.tsx` |
| F | Shortcuts (configurable) | `settings-modal.tsx`, `settings-shortcuts.tsx`, `chat-context.tsx` |
| G | Message UX | `chat-content.tsx`, `message-bubble.tsx`, `message-actions.tsx` |
| H | Plugin system | `plugins/`, `chat-context.tsx`, `settings-plugins.tsx` |
| I | Unit tests | `test/`, `hooks/`, `components/lite-chat/` |

---

# **Execution Notes**

- **Each task should be implemented in isolation and tested before merging.**
- **All changes should be accompanied by relevant unit/E2E tests.**
- **Documentation (README, code comments) should be updated as features are added.**
- **Major refactors (A, B, H) should be done in feature branches.**
- **Plugin system (H) should be designed with security in mind.**

---
