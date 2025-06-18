# Composite Interaction Architecture Refactor Plan

## Problem Statement

LiteChat currently has **architectural debt** in how it handles "composite interactions" - interactions that consist of a main interaction plus multiple child interactions:

### Current Problematic Patterns

1. **Workflow System**: Main interaction + workflow step children
2. **Race System**: Main interaction + race candidate children  
3. **Future Systems**: Any multi-step, multi-response interactions

### Issues with Current Architecture

1. **Forced Patterns**: Both systems hack around the simple interaction model
2. **Manual Interaction Management**: Custom interaction creation and stream buffer manipulation
3. **Middleware Complexity**: Race middleware cancels and recreates interactions manually
4. **Inconsistent Rendering**: Special cases in InteractionCard for different composite types
5. **Data Fragmentation**: State split between parent metadata and child interactions
6. **Performance Issues**: Multiple reactive subscriptions across parent+children
7. **Extension Difficulty**: Hard to add new composite interaction types

## Solution: Proper Composite Interaction Architecture

### Core Design Principles

1. **Unified Model**: Single interface for all composite interactions
2. **Clean Separation**: Clear boundaries between simple and composite interactions
3. **Extensible**: Easy to add new composite interaction types
4. **Performance**: Efficient rendering and state management
5. **Consistent UX**: Unified rendering patterns across all composite types

## Architectural Design

### 1. Composite Interaction Type System

```typescript
// New interaction type hierarchy
type InteractionType = 
  | 'message.user'
  | 'message.assistant' 
  | 'message.user_assistant'
  | 'workflow.composite'      // NEW: Workflow composite
  | 'race.composite'          // NEW: Race composite
  | 'future.composite';       // NEW: Extensible for future types

// Composite interaction metadata
interface CompositeMetadata {
  compositeType: 'workflow' | 'race' | string;
  templateId?: string;
  state: 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  childrenIds: string[];
  progress?: CompositeProgress;
}

interface CompositeProgress {
  current: number;
  total: number;
  completedChildren: string[];
  activeChild?: string;
}
```

### 2. Composite Interaction Service

```typescript
// New service for managing composite interactions
interface CompositeInteractionService {
  // Create composite interaction with proper typing
  createComposite(params: CreateCompositeParams): Promise<Interaction>;
  
  // Add child to composite
  addChild(parentId: string, childData: ChildInteractionData): Promise<Interaction>;
  
  // Update composite state
  updateCompositeState(parentId: string, state: Partial<CompositeMetadata>): Promise<void>;
  
  // Get complete composite data (parent + all children)
  getCompositeData(parentId: string): Promise<CompositeData>;
  
  // Stream management for composites
  streamToComposite(parentId: string, stream: ReadableStream): Promise<void>;
}

interface CompositeData {
  parent: Interaction;
  children: Interaction[];
  metadata: CompositeMetadata;
  renderConfig: CompositeRenderConfig;
}

interface CompositeRenderConfig {
  layout: 'sequential' | 'parallel' | 'tree';
  childRenderer: 'default' | 'workflow-step' | 'race-candidate';
  progressDisplay: 'none' | 'linear' | 'visual';
  allowPause?: boolean;
  allowCancel?: boolean;
}
```

### 3. Composite Rendering System

#### A. Composite Interaction Card
```typescript
// New component for composite interactions
interface CompositeInteractionCard {
  interaction: Interaction; // The parent interaction
  compositeData: CompositeData;
  renderConfig: CompositeRenderConfig;
}

// Replaces special cases in InteractionCard.tsx
function CompositeInteractionCard({ interaction, compositeData, renderConfig }) {
  const { parent, children, metadata } = compositeData;
  
  return (
    <div className="composite-interaction">
      {/* Parent interaction header */}
      <CompositeHeader interaction={parent} metadata={metadata} />
      
      {/* Progress display */}
      {renderConfig.progressDisplay !== 'none' && (
        <CompositeProgress metadata={metadata} config={renderConfig} />
      )}
      
      {/* Children rendering */}
      <CompositeChildren 
        children={children}
        renderer={renderConfig.childRenderer}
        layout={renderConfig.layout}
      />
      
      {/* Composite actions */}
      <CompositeActions metadata={metadata} config={renderConfig} />
    </div>
  );
}
```

#### B. Specialized Renderers
```typescript
// Workflow-specific renderer
function WorkflowCompositeRenderer({ compositeData }: { compositeData: CompositeData }) {
  const { parent, children, metadata } = compositeData;
  const template = getWorkflowTemplate(parent.metadata.workflowTemplateId);
  
  return (
    <div className="workflow-composite">
      <WorkflowVisualizer 
        workflow={template}
        stepStatuses={mapChildrenToStepStatuses(children)}
        currentStep={metadata.progress?.activeChild}
      />
      <WorkflowStepsList children={children} template={template} />
    </div>
  );
}

// Race-specific renderer  
function RaceCompositeRenderer({ compositeData }: { compositeData: CompositeData }) {
  return (
    <div className="race-composite">
      <RaceProgress metadata={compositeData.metadata} />
      <RaceCandidates children={compositeData.children} />
    </div>
  );
}
```

### 4. Canvas Control System Enhancement

#### A. Composite-Aware Canvas Controls
```typescript
// Enhanced canvas control registration
interface CanvasControlConfig {
  type: InteractionType | InteractionType[];
  targetSlot: CanvasSlot;
  compositeTypes?: string[]; // NEW: Filter by composite type
  shouldRegister: (context: CanvasControlContext) => boolean;
}

// Enhanced context for composite interactions
interface CanvasControlContext {
  interaction: Interaction;
  compositeData?: CompositeData; // NEW: Available for composite interactions
  conversation: Conversation;
  interactionIndex: number;
}

// Example: Workflow-specific canvas control
const workflowVisualizerControl: CanvasControlConfig = {
  type: 'workflow.composite',
  targetSlot: 'content',
  shouldRegister: (context) => {
    return context.compositeData?.metadata.compositeType === 'workflow';
  },
  renderer: (context) => (
    <WorkflowVisualizerControl compositeData={context.compositeData} />
  )
};
```

#### B. New Canvas Slots
```typescript
// Enhanced slot system for composite interactions
type CanvasSlot = 
  | 'header-actions'
  | 'actions' 
  | 'content'
  | 'composite-header'    // NEW: Composite-specific header
  | 'composite-progress'  // NEW: Progress display area
  | 'composite-content'   // NEW: Main composite content
  | 'composite-actions'   // NEW: Composite-specific actions
  | 'codeblock-*';
```

### 5. Store Architecture Enhancement

#### A. Composite Store Pattern
```typescript
// Enhanced interaction store with composite support
interface InteractionStore {
  // Existing simple interaction methods
  interactions: Record<string, Interaction>;
  
  // NEW: Composite interaction methods
  compositeData: Record<string, CompositeData>;
  
  // Enhanced getters
  getInteraction(id: string): Interaction | null;
  getCompositeData(parentId: string): CompositeData | null;
  getInteractionWithComposite(id: string): EnhancedInteractionData;
  
  // Enhanced actions
  setCompositeData(parentId: string, data: CompositeData): void;
  updateCompositeMetadata(parentId: string, metadata: Partial<CompositeMetadata>): void;
  addCompositeChild(parentId: string, child: Interaction): void;
}

interface EnhancedInteractionData {
  interaction: Interaction;
  isComposite: boolean;
  compositeData?: CompositeData;
}
```

#### B. Workflow Store Refactor
```typescript
// Simplified workflow store (less responsibility)
interface WorkflowStore {
  // Remove interaction management (moved to composite system)
  activeRuns: Record<string, WorkflowRun>;
  templates: Record<string, WorkflowTemplate>;
  
  // Keep only workflow-specific logic
  executeWorkflow(templateId: string, inputs: Record<string, any>): Promise<string>;
  pauseWorkflow(runId: string): Promise<void>;
  resumeWorkflow(runId: string): Promise<void>;
  cancelWorkflow(runId: string): Promise<void>;
}
```

### 6. Service Layer Refactor

#### A. AI Service Enhancement
```typescript
// Enhanced AI service with composite support
interface AIService {
  // Existing methods
  sendMessage(params: SendMessageParams): Promise<Interaction>;
  
  // NEW: Composite interaction support
  createCompositeInteraction(params: CreateCompositeParams): Promise<Interaction>;
  streamToComposite(parentId: string, stream: ReadableStream): Promise<void>;
  addCompositeChild(parentId: string, params: AddChildParams): Promise<Interaction>;
}

// Enhanced workflow service
interface WorkflowService {
  // Focus only on workflow execution logic
  executeWorkflow(templateId: string, inputs: any): Promise<WorkflowRun>;
  
  // Composite integration
  createWorkflowComposite(runId: string): Promise<string>; // Returns parent interaction ID
  addWorkflowStep(parentId: string, stepData: StepData): Promise<Interaction>;
}
```

#### B. Middleware Simplification
```typescript
// Simplified race middleware (no more interaction hijacking)
function raceMiddleware(params: SendMessageParams): SendMessageParams {
  if (params.shouldRace) {
    // Transform to composite interaction request
    return {
      ...params,
      compositeType: 'race',
      compositeConfig: {
        candidates: params.raceProviders,
        layout: 'parallel',
        progressDisplay: 'linear'
      }
    };
  }
  return params;
}

// No more manual interaction creation/cancellation
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
1. **Define Type System**
   - Create composite interaction types
   - Define interfaces and metadata structures
   - Update database schema for composite support

2. **Create Composite Service**
   - Implement `CompositeInteractionService`
   - Basic CRUD operations for composite interactions
   - Stream management for composites

### Phase 2: Rendering System (Week 2-3)
1. **Create Composite Components**
   - `CompositeInteractionCard`
   - `CompositeHeader`, `CompositeProgress`, `CompositeChildren`
   - Specialized renderers (Workflow, Race)

2. **Enhance Canvas Control System**
   - Add composite support to canvas controls
   - Implement new canvas slots
   - Update existing controls for compatibility

### Phase 3: Store Integration (Week 3-4)
1. **Enhance Interaction Store**
   - Add composite data management
   - Implement reactive composite queries
   - Ensure performance optimization

2. **Simplify Existing Stores**
   - Refactor workflow store (remove interaction management)
   - Clean up race store
   - Remove redundant state management

### Phase 4: Service Migration (Week 4-5)
1. **Migrate Workflow System**
   - Update workflow service to use composite interactions
   - Migrate existing workflow interactions
   - Remove workflow-specific hacks from InteractionCard

2. **Migrate Race System**
   - Update race middleware to use composite interactions
   - Remove race-specific interaction hijacking
   - Simplify race rendering logic

### Phase 5: Testing & Optimization (Week 5-6)
1. **Comprehensive Testing**
   - Unit tests for all composite components
   - Integration tests for workflow/race migration
   - Performance testing for large composite interactions

2. **Performance Optimization**
   - Optimize reactive queries for composite data
   - Implement proper memoization
   - Reduce re-renders in composite components

### Phase 6: Migration & Cleanup (Week 6)
1. **Data Migration**
   - Migrate existing workflow/race interactions
   - Update database schema
   - Ensure backward compatibility

2. **Code Cleanup**
   - Remove old special cases from InteractionCard
   - Clean up dead code in workflow/race services
   - Update documentation

## Benefits of This Approach

### 1. Architectural Cleanliness
- **Unified Model**: Single pattern for all composite interactions
- **Clear Separation**: Distinct handling of simple vs composite interactions
- **Extensible**: Easy to add new composite types (multi-agent, tool chains, etc.)

### 2. Performance Improvements
- **Optimized Queries**: Single composite data query vs multiple reactive subscriptions
- **Efficient Rendering**: Purpose-built composite components vs hacked simple components
- **Reduced Re-renders**: Proper memoization and state management

### 3. Developer Experience
- **Consistent Patterns**: Same approach for all composite interactions
- **Better Debugging**: Clear data flow and state management
- **Easier Testing**: Isolated composite logic

### 4. User Experience
- **Consistent UI**: Unified composite interaction design
- **Better Performance**: Faster rendering and updates
- **Enhanced Features**: Proper progress display, pause/resume, etc.

### 5. Future-Proofing
- **New Composite Types**: Easy to add multi-agent conversations, tool chains, etc.
- **Enhanced Features**: Proper foundation for advanced workflow features
- **Scalability**: Architecture scales to complex composite interactions

## Migration Strategy

### Backward Compatibility
- **Gradual Migration**: Support both old and new systems during transition
- **Feature Flags**: Toggle new composite system on/off
- **Data Migration**: Automated migration of existing interactions

### Risk Mitigation
- **Phased Rollout**: Phase-by-phase implementation with testing
- **Rollback Plan**: Ability to revert to old system if issues arise
- **Monitoring**: Comprehensive logging and error tracking

### User Communication
- **Transparent Updates**: Clear communication about improvements
- **No UX Disruption**: Seamless transition for end users
- **Enhanced Features**: Users get better visualization without disruption

## Technical Debt Resolution

This refactor resolves multiple architectural debt issues:

1. **✅ Eliminates Race Middleware Hacks**: No more interaction cancellation/recreation
2. **✅ Unifies Composite Patterns**: Single approach for workflows, races, and future types
3. **✅ Proper State Management**: Centralized composite data with reactive queries
4. **✅ Clean Rendering**: Purpose-built components vs special cases
5. **✅ Performance Optimization**: Efficient data access and rendering
6. **✅ Extensibility**: Foundation for future composite interaction types

## Success Metrics

### Technical Metrics
- **Code Reduction**: 30-40% reduction in composite interaction handling code
- **Performance**: 50%+ improvement in composite interaction rendering performance
- **Test Coverage**: 90%+ coverage for all composite interaction components
- **Bug Reduction**: 80%+ reduction in composite interaction related bugs

### User Experience Metrics
- **Faster Rendering**: Sub-100ms composite interaction updates
- **Consistent UX**: Unified design across all composite types
- **Feature Completeness**: Full workflow visualization, race progress, pause/resume

This comprehensive refactor provides the proper foundation for composite interactions while resolving existing architectural debt and setting up LiteChat for future extensibility. 