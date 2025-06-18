# Workflow System

LiteChat's **Workflow System** enables users to create, manage, and execute automated sequences of AI interactions. This powerful feature allows for complex multi-step AI workflows with dynamic prompt templating, variable mapping, and intelligent step orchestration.

## Overview

The workflow system transforms LiteChat from a simple chat interface into a sophisticated AI automation platform. Users can define sequences of interactions that automatically execute in sequence, with each step potentially using different models, templates, or processing logic.

### Key Features

- **Visual Workflow Builder**: Intuitive tabbed interface for creating and editing workflows
- **React Flow Visualization**: Interactive workflow diagrams with animated connections and step type indicators
- **Raw JSON Editor**: Direct workflow editing with real-time validation and schema checking
- **Persistent Workflow Library**: Save, load, edit, and fork workflows with full database persistence  
- **Dynamic Trigger Configuration**: Custom prompts, template-based triggers, or agent tasks
- **Multi-Step Orchestration**: Automated execution with output passing between steps
- **Model Selection per Step**: Different AI models for different workflow stages
- **Template Integration**: Leverage existing prompt templates and agent tasks
- **Real-Time Execution**: Live workflow execution with streaming responses
- **Error Handling**: Graceful error recovery and workflow state management

## Architecture

### Core Components

#### 1. WorkflowControlModule
Located in `src/controls/modules/WorkflowControlModule.ts`, this is the main control module that:
- Manages workflow-related UI components
- Handles workflow execution requests
- Integrates with the persistence layer
- Provides workflow data to UI components

#### 2. Workflow Builder UI
The main workflow interface consists of two primary components:

**WorkflowBuilder** (`src/controls/components/workflow/WorkflowBuilder.tsx`):
- Tabbed interface with workflow list and builder
- Save, fork, and run functionality
- Integration with prompt templates and agent tasks
- Dynamic trigger configuration

**WorkflowList** (`src/controls/components/workflow/WorkflowList.tsx`):
- Grid-based workflow library display
- Workflow management (edit, delete, duplicate, run)
- Empty states and creation workflows

**WorkflowVisualizer** (`src/controls/components/workflow/WorkflowVisualizer.tsx`):
- React Flow-based workflow visualization
- Custom node components for different step types
- Animated connections between workflow steps
- Read-only interactive diagram with zoom and pan

**WorkflowRawEditor** (`src/controls/components/workflow/WorkflowRawEditor.tsx`):
- JSON editor with syntax highlighting
- Real-time workflow validation
- Schema validation with detailed error messages
- Separate save functionality with database persistence

#### 4. Reusable Components

**CodeEditor** (`src/components/LiteChat/common/CodeEditor.tsx`):
- Extracted from EditCodeBlockControl for reusability
- Syntax highlighting with Prism.js
- Error display with Alert components
- Optional save functionality with async handling
- Support for multiple programming languages

#### 3. Workflow Execution Engine
**WorkflowService** (`src/services/workflow.service.ts`):
- Manages workflow execution state
- Handles step-by-step processing
- Integrates with AI providers and interaction system
- Manages workflow runs and state transitions

#### 4. Data Persistence
**PersistenceService** (`src/services/persistence.service.ts`):
- Database operations for workflow templates
- Workflow loading, saving, and deletion
- Integration with LiteChat's IndexedDB schema

### Type Definitions

Located in `src/types/litechat/workflow.ts`:

```typescript
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  modelId?: string;
  templateId?: string;
  instructionsForHuman?: string;
  inputMapping?: Record<string, string>;
  prompt?: string;
  structuredOutput?: {
    schema: Record<string, any>;
    jsonSchema: object;
  };
}

export type WorkflowStepType = "prompt" | "agent-task" | "human-in-the-loop";

export interface WorkflowRun {
  runId: string;
  conversationId: string;
  mainInteractionId: string;
  template: WorkflowTemplate;
  status: WorkflowRunStatus;
  currentStepIndex: number;
  stepOutputs: Record<string, any>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}
```

## Usage Guide

### Creating a New Workflow

1. **Open Workflow Builder**: Click the workflow icon in the prompt controls
2. **Navigate to Builder**: Click "Create New Workflow" or use the "New Workflow" tab
3. **Configure Basic Information**:
   - Set workflow name and description
   - Choose trigger type (Custom Prompt, Template, or Agent Task)
   - Configure the initial message/trigger
4. **Add Workflow Steps**:
   - Click "Add Step" to create subsequent steps
   - Configure each step's model, template, and parameters
   - Set up input mapping for data flow between steps
5. **Save Workflow**: Use the "Save" button to persist the workflow

### Managing Existing Workflows

#### From the Workflow List:
- **Edit**: Click the edit icon to modify an existing workflow
- **Run**: Click play icon to execute with a custom initial message
- **Duplicate**: Create a copy of the workflow for modification
- **Delete**: Remove workflows with confirmation dialog

#### From the Builder:
- **Save**: Update the current workflow in the database
- **Fork**: Create a new copy of the current workflow
- **Run**: Execute the workflow with the configured trigger

### Workflow Execution

When a workflow runs:

1. **Initialization**: Creates a main interaction to host the workflow
2. **Trigger Step**: Executes the initial prompt/template to start the sequence
3. **Sequential Processing**: Each subsequent step processes automatically
4. **Output Passing**: Results from previous steps flow to subsequent steps
5. **Completion**: Workflow completes when all steps finish successfully

## Development Guide

### Adding New Step Types

To add a new workflow step type:

1. **Update Type Definition**:
   ```typescript
   // In src/types/litechat/workflow.ts
   export type WorkflowStepType = "prompt" | "agent-task" | "human-in-the-loop" | "your-new-type";
   ```

2. **Extend WorkflowStep Interface**:
   ```typescript
   export interface WorkflowStep {
     // ... existing fields
     yourNewTypeConfig?: YourConfigType;
   }
   ```

3. **Update WorkflowStepCard Component**:
   ```typescript
   // In src/controls/components/workflow/WorkflowStepCard.tsx
   // Add UI for configuring your new step type
   ```

4. **Implement Execution Logic**:
   ```typescript
   // In src/services/workflow.service.ts
   // Add handling for your new step type in createWorkflowStep
   ```

### Integrating with New Data Sources

To integrate workflows with new prompt templates or data sources:

1. **Update WorkflowControlModule**:
   ```typescript
   // Add new data loading methods
   async loadYourDataSource(): Promise<YourDataType[]> {
     // Implementation
   }
   
   getYourDataSource(): YourDataType[] {
     return this.yourDataSource;
   }
   ```

2. **Update Builder UI**:
   ```typescript
   // In WorkflowBuilder.tsx, add new trigger types or step options
   const yourDataSource = module.getYourDataSource();
   ```

3. **Add Event Subscriptions**:
   ```typescript
   // In WorkflowControlModule.initialize()
   const unsubYourEvent = modApi.on(
     yourEvent.dataChanged,
     (payload) => {
       this.yourDataSource = payload.data;
       this.notifyComponentUpdate?.();
     }
   );
   ```

### Custom Workflow Actions

To add custom workflow actions (like export, import, templates):

1. **Extend WorkflowControlModule**:
   ```typescript
   async exportWorkflows(): Promise<void> {
     // Implementation using ImportExportService
   }
   
   async importWorkflows(file: File): Promise<void> {
     // Implementation
   }
   ```

2. **Add UI Controls**:
   ```typescript
   // In WorkflowList.tsx, add action buttons
   <Button onClick={() => module.exportWorkflows()}>
     Export Workflows
   </Button>
   ```

3. **Update Events** (if needed):
   ```typescript
   // In src/types/litechat/events/workflow.events.ts
   export const workflowEvent = {
     // ... existing events
     exportRequest: 'workflow:export-request',
     importRequest: 'workflow:import-request',
   } as const;
   ```

## Event Integration

The workflow system integrates with LiteChat's event system:

### Workflow Events
- `workflow:start-request` - Request to start a workflow
- `workflow:step-completed` - A workflow step has completed
- `workflow:paused` - Workflow execution paused
- `workflow:resumed` - Workflow execution resumed
- `workflow:completed` - Entire workflow completed
- `workflow:error` - Workflow execution error
- `workflow:cancelled` - Workflow was cancelled

### Usage in Components
```typescript
// Listening for workflow events
modApi.on(workflowEvent.completed, (payload) => {
  console.log(`Workflow ${payload.runId} completed`);
});

// Triggering workflow execution
modApi.emit(workflowEvent.startRequest, {
  template: workflowTemplate,
  initialPrompt: "Hello world",
  conversationId: currentConversationId
});
```

## Database Schema

Workflows are stored in the `workflows` table with the following schema:

```typescript
interface DbWorkflow {
  id: string;           // Primary key
  name: string;         // Display name
  description: string;  // User description
  definition: string;   // JSON serialized WorkflowTemplate
  createdAt: Date;      // Creation timestamp
  updatedAt: Date;      // Last modification timestamp
}
```

### Persistence Operations

```typescript
// Load all workflows
const workflows = await PersistenceService.loadWorkflows();

// Save a workflow
await PersistenceService.saveWorkflow(workflowTemplate);

// Delete a workflow
await PersistenceService.deleteWorkflow(workflowId);
```

## User Interface Design

### Tabbed Layout Architecture
The workflow system uses LiteChat's `TabbedLayout` component with multiple levels:

**Main Level**:
1. **Workflows Tab**: Lists all saved workflows in a responsive grid
2. **Builder Tab**: Full workflow editor with trigger configuration and step management

**Builder Tab Sub-levels**:
1. **Builder**: Traditional step-by-step workflow configuration
2. **Visualizer**: React Flow diagram showing workflow structure
3. **Raw Editor**: Direct JSON editing with validation

### Design Principles
- **No Nested Scrollbars**: Only the main modal scrolls, following LiteChat's UX guidelines
- **Large Modal Size**: Uses 95vw × 85vh for optimal workflow editing experience
- **Responsive Grid**: Workflow cards adapt to screen size (1-3 columns)
- **Action Clarity**: Clear visual distinction between save, fork, run, and cancel actions

### Component Hierarchy
```
WorkflowBuilder (Main Modal)
├── TabbedLayout (Main Level)
│   ├── WorkflowList (Tab 1)
│   │   ├── Workflow Cards Grid
│   │   └── Action Buttons (Run, Edit, Duplicate, Delete)
│   └── Builder Interface (Tab 2)
│       ├── Trigger Configuration (1/4 in XL, 1/3 in LG)
│       │   ├── Workflow Name & Description
│       │   ├── Trigger Type Selection
│       │   └── Trigger Configuration
│       └── Steps Section (3/4 in XL, 2/3 in LG)
│           └── TabbedLayout (Steps Level)
│               ├── Builder Tab
│               │   ├── Step Cards List
│               │   └── Add Step Button
│               ├── Visualizer Tab
│               │   └── React Flow Diagram
│               └── Raw Editor Tab
│                   ├── JSON Editor with Validation
│                   └── Save Button
└── Dialog Footer (Builder tab only)
    ├── Cancel Button
    ├── Save Button
    ├── Fork Button (if editing)
    └── Run Workflow Button
```

## Best Practices

### Workflow Design
- **Single Responsibility**: Each workflow step should have a clear, single purpose
- **Error Handling**: Design workflows with fallback steps for error scenarios
- **Variable Mapping**: Use consistent variable names across steps for easier mapping
- **Testing**: Test workflows with various inputs before production use

### Performance Considerations
- **Model Selection**: Choose appropriate models for each step's complexity
- **Step Granularity**: Balance between too many small steps and too few large steps
- **Memory Usage**: Be mindful of data passed between steps in complex workflows

### User Experience
- **Clear Naming**: Use descriptive names for workflows and steps
- **Documentation**: Include helpful descriptions for complex workflows
- **Progressive Disclosure**: Start with simple workflows before building complex ones

## Troubleshooting

### Common Issues

**Workflow Won't Start**:
- Check that a conversation is active
- Verify trigger configuration is complete
- Ensure required template variables are filled

**Steps Not Executing**:
- Verify step order and dependencies
- Check model availability and permissions
- Review input mapping configuration

**Execution Errors**:
- Check AI provider connectivity
- Verify prompt template validity
- Review step configuration for missing required fields

### Debug Information
The workflow system provides detailed logging:
- Workflow execution states in browser console
- Step completion events and timings
- Error messages with context for troubleshooting

## Future Enhancements

The workflow system is designed for extensibility. Planned enhancements include:

- **Conditional Branching**: If/then logic in workflow execution
- **Loop Support**: Repeating steps with iteration control
- **External Integrations**: API calls and webhook support
- **Workflow Templates**: Pre-built workflow templates for common use cases
- **Collaborative Workflows**: Sharing workflows between users
- **Advanced Variable Mapping**: Complex data transformations between steps

---

The workflow system represents LiteChat's commitment to powerful AI automation while maintaining the privacy-first, client-side architecture that makes LiteChat unique. By combining intuitive visual design with powerful execution capabilities, it enables users to create sophisticated AI workflows without compromising on data privacy or control. 