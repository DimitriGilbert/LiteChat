# LiteChat Prompt Flow Analysis

## Overview

This document provides a comprehensive analysis of how prompts flow through the LiteChat system, from user input to AI submission. Understanding this flow is critical for implementing features like text triggers that need to modify prompt data at the right time.

## Complete Flow Sequence

### 1. User Input Phase (`InputArea.tsx`)

**Location**: `src/components/LiteChat/prompt/InputArea.tsx`

- User types in the textarea
- Text triggers are parsed for **UI suggestions only** (autocomplete)
- No actual trigger execution happens here
- Input value is stored in `usePromptInputValueStore`

**Key Code**:
```typescript
const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const newValue = e.target.value;
  setInternalValue(newValue);
  setPromptInputValue(newValue); // Global state
  // ... autocomplete logic for text triggers
};
```

### 2. Prompt Submission Trigger (`PromptWrapper.tsx`)

**Location**: `src/components/LiteChat/prompt/PromptWrapper.tsx`

When user presses Enter or clicks submit:

```typescript
const handleSubmit = async () => {
  // 1. Get current input value
  const trimmedValue = inputValue.trim();
  
  // 2. Collect parameters from various sources
  const parameters = {
    temperature: promptState.temperature,
    // ... other params
  };
  
  // 3. Collect metadata from various sources  
  const metadata = {
    attachedFiles: attachedFiles,
    // NOTE: enabledTools is NOT set here!
  };
  
  // 4. Create initial turnData
  let turnData: PromptTurnObject = {
    id: nanoid(),
    content: trimmedValue,
    parameters,
    metadata,
  };
  
  // 5. EMIT promptEvent.submitted - TEXT TRIGGERS PROCESS HERE
  emitter.emit(promptEvent.submitted, { turnData });
  
  // 6. Run middleware (PROMPT_TURN_FINALIZE)
  const middlewareResult = await runMiddleware(
    ModMiddlewareHook.PROMPT_TURN_FINALIZE,
    { turnData }
  );
  
  // 7. Submit to ConversationService
  await onSubmit(finalTurnData);
};
```

**Critical Point**: `enabledTools` is NOT in the initial `turnData.metadata`. This is where text triggers should add it!

### 3. Text Trigger Processing (Current Implementation)

**Location**: `src/controls/modules/TextTriggerControlModule.ts`

**Current Hook**: `promptEvent.submitted` (CORRECT!)
**Current Problem**: Processes triggers but only cleans text, doesn't modify metadata

```typescript
// CURRENT (BROKEN) - only cleans text
const unregisterPromptListener = modApi.on(promptEvent.submitted, async (payload) => {
  const cleanedContent = await this.parserService.executeTriggersAndCleanText(
    turnData.content,
    { turnData, promptText: turnData.content }
  );
  turnData.content = cleanedContent; // Only modifies content!
});
```

**What Should Happen**: Text triggers should modify `turnData.metadata` here:
- `@.tools.activate webSearch` → `turnData.metadata.enabledTools = ['webSearch']`
- `@.params.temp 0.8` → `turnData.parameters.temperature = 0.8`
- `@.rules.select rule1` → `turnData.metadata.activeRuleIds = ['rule1']`

### 4. Middleware Phase (`PROMPT_TURN_FINALIZE`)

**Location**: Various control modules
**Timing**: After text triggers, before conversation service

```typescript
// Middleware can modify turnData but has limited context
const middlewareResult = await runMiddleware(
  ModMiddlewareHook.PROMPT_TURN_FINALIZE,
  { turnData }
);
```

**Limitations**:
- No access to UI state
- No access to control registries
- Can only work with data already in `turnData`

### 5. Conversation Service (`ConversationService.submitPrompt`)

**Location**: `src/services/conversation.service.ts`

```typescript
async submitPrompt(turnData: PromptTurnObject): Promise<void> {
  // 1. Get conversation context
  const conversationId = interactionStoreState.currentConversationId;
  
  // 2. Build conversation history
  const messages = await this.buildConversationMessages(conversationId, turnData);
  
  // 3. Create PromptObject for AI
  const promptObject: PromptObject = {
    system: systemPrompt,
    messages,
    parameters: turnData.parameters,
    metadata: turnData.metadata, // enabledTools should be here!
  };
  
  // 4. Start interaction
  await InteractionService.startInteraction(promptObject, conversationId, turnData);
}
```

### 6. Interaction Service (`InteractionService.startInteraction`)

**Location**: `src/services/interaction.service.ts`

This is where tools are actually resolved and added to the prompt:

```typescript
async startInteraction(prompt: PromptObject, conversationId: string, turnData: PromptTurnObject) {
  // 1. Run INTERACTION_BEFORE_START middleware
  const middlewareResult = await runMiddleware(
    ModMiddlewareHook.INTERACTION_BEFORE_START,
    { prompt, conversationId }
  );
  
  // 2. RESOLVE TOOLS - This is the key step!
  const enabledTools = prompt.metadata?.enabledTools || [];
  const toolRegistry = useControlRegistryStore.getState().tools;
  const resolvedTools: Tool[] = enabledTools
    .map(toolId => toolRegistry[toolId])
    .filter(Boolean)
    .map(tool => tool.definition);
  
  // 3. Create final prompt with tools
  const finalPrompt = {
    ...prompt,
    tools: resolvedTools.length > 0 ? resolvedTools : undefined,
  };
  
  // 4. Send to AI
  await AIService.generateCompletion(finalPrompt);
}
```

**Critical Point**: Tools are resolved from `prompt.metadata.enabledTools` here. If text triggers don't set this field, no tools will be included!

## Data Structures

### PromptTurnObject (Initial)
```typescript
interface PromptTurnObject {
  id: string;
  content: string; // User input text
  parameters: {
    temperature?: number;
    maxTokens?: number;
    // ... other AI parameters
  };
  metadata: {
    enabledTools?: string[]; // Tool IDs - SET BY TEXT TRIGGERS
    activeRuleIds?: string[]; // Rule IDs - SET BY TEXT TRIGGERS  
    attachedFiles?: AttachedFile[];
    // ... other metadata
  };
}
```

### PromptObject (Final)
```typescript
interface PromptObject {
  system?: string; // System prompt
  messages: CoreMessage[]; // Conversation history
  tools?: Tool[]; // Resolved tool definitions
  parameters: Record<string, any>; // AI parameters
  metadata: Record<string, any>; // Metadata (including enabledTools)
}
```

## The Problem with Current Text Trigger Implementation

### Issue 1: Wrong Processing Location
- **Current**: Text triggers process in middleware (`PROMPT_TURN_FINALIZE`)
- **Should Be**: Text triggers process on `promptEvent.submitted` (ALREADY CORRECT!)

### Issue 2: Only Modifies Content, Not Metadata
- **Current**: `turnData.content = cleanedContent` (only removes trigger text)
- **Should Be**: Also modify `turnData.metadata.enabledTools`, `turnData.parameters`, etc.

### Issue 3: Control Module Handlers Don't Modify TurnData
- **Current**: Handlers like `handleToolsActivate` modify UI state
- **Should Be**: Handlers modify `context.turnData.metadata` directly

## Correct Implementation Strategy

### 1. Text Trigger Processing (TextTriggerControlModule)
```typescript
// CORRECT - Listen to promptEvent.submitted
const unregisterPromptListener = modApi.on(promptEvent.submitted, async (payload) => {
  const { turnData } = payload;
  
  // Execute triggers - they will modify turnData directly
  const cleanedContent = await this.parserService.executeTriggersAndCleanText(
    turnData.content,
    { turnData, promptText: turnData.content }
  );
  
  // Update content (remove trigger text)
  turnData.content = cleanedContent;
});
```

### 2. Control Module Handlers
```typescript
// CORRECT - Modify turnData metadata directly
private handleToolsActivate = async (args: string[], context: TriggerExecutionContext) => {
  if (!context.turnData.metadata.enabledTools) {
    context.turnData.metadata.enabledTools = [];
  }
  
  args.forEach(toolId => {
    if (!context.turnData.metadata.enabledTools!.includes(toolId)) {
      context.turnData.metadata.enabledTools!.push(toolId);
    }
  });
};
```

### 3. Parameter Handlers
```typescript
// CORRECT - Modify turnData parameters directly
private handleParamsTemp = async (args: string[], context: TriggerExecutionContext) => {
  const temp = parseFloat(args[0]);
  if (!isNaN(temp) && temp >= 0 && temp <= 2) {
    context.turnData.parameters.temperature = temp;
  }
};
```

## Flow Diagram

```
User Input (InputArea)
         ↓
Prompt Submission (PromptWrapper)
         ↓
Create turnData {content, parameters, metadata}
         ↓
Emit promptEvent.submitted
         ↓
TEXT TRIGGERS PROCESS HERE ← MODIFY turnData.metadata!
         ↓
Middleware (PROMPT_TURN_FINALIZE)
         ↓
ConversationService.submitPrompt
         ↓
Build PromptObject {system, messages, parameters, metadata}
         ↓
InteractionService.startInteraction
         ↓
Resolve tools from metadata.enabledTools
         ↓
Create final prompt with tools
         ↓
Send to AI
```

## Key Takeaways

1. **Text triggers must modify `turnData.metadata` during `promptEvent.submitted`**
2. **Tools are resolved late in `InteractionService` from `metadata.enabledTools`**
3. **Middleware cannot access UI state or control registries**
4. **The current implementation only cleans text but doesn't set metadata**
5. **All control module handlers need to modify `turnData` directly, not UI state**

This analysis shows that the text trigger system is almost correctly positioned in the flow, but the handlers need to be fixed to modify the actual data that gets sent to the AI, not just UI state.