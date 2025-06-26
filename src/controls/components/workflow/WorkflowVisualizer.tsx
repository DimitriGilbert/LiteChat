import React, { useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import { cn } from '@/lib/utils';
import type { WorkflowTemplate, WorkflowStep } from '@/types/litechat/workflow';
import { getTreeLayout } from '@/lib/litechat/tree-layout';

import '@xyflow/react/dist/style.css';

// Step data that the visualizer receives - STATIC DISPLAY ONLY
interface StepDisplayData {
  stepName: string;
  templateName?: string;
  modelName?: string;
  type: string;
  status?: StepStatus;
  toolName?: string;
  functionLanguage?: string;
}

// Step status for workflow execution
type StepStatus = 'pending' | 'running' | 'success' | 'error';

interface WorkflowVisualizerProps {
  workflow: WorkflowTemplate;
  className?: string;
  // STATIC data prepared by the builder - NO PROCESSING IN VISUALIZER
  initialStepData: StepDisplayData;
  stepDisplayData: StepDisplayData[];
  // Optional step statuses for execution visualization
  stepStatuses?: Record<string, StepStatus>;
}

// const HORIZONTAL_SPACING = 400;

const WorkflowStepNode: React.FC<{ data: any }> = ({ data }) => {
  const getNodeColor = (type: string, status?: StepStatus) => {
    if (status) {
      switch (status) {
        case 'running':
          return 'bg-[var(--foreground)] border-[var(--primary)] text-[var(--background)] shadow-lg shadow-[var(--primary)/20]';
        case 'success':
          return 'bg-[var(--foreground)] border-[var(--chart-2)] text-[var(--background)] shadow-lg shadow-[var(--chart-2)/20]';
        case 'error':
          return 'bg-[var(--foreground)] border-[var(--destructive)] text-[var(--destructive)] shadow-lg shadow-[var(--destructive)/20]';
        case 'pending':
          return 'bg-[var(--foreground)] border-[var(--muted)] text-[var(--background)] shadow-lg shadow-[var(--muted)/20]';
      }
    }
    
    switch (type) {
      case 'initial':
        return 'bg-[var(--foreground)] border-[var(--primary)] text-[var(--background)] shadow-sm';
      case 'prompt':
        return 'bg-[var(--foreground)] border-[var(--chart-1)] text-[var(--background)] shadow-sm';
      case 'agent-task':
        return 'bg-[var(--foreground)] border-[var(--chart-2)] text-[var(--background)] shadow-sm';
      case 'transform':
        return 'bg-[var(--foreground)] border-[var(--chart-3)] text-[var(--background)] shadow-sm';
      case 'human-in-the-loop':
        return 'bg-[var(--foreground)] border-[var(--chart-4)] text-[var(--background)] shadow-sm';
      case 'tool-call':
        return 'bg-[var(--foreground)] border-[var(--chart-5)] text-[var(--background)] shadow-sm';
      case 'custom-prompt':
        return 'bg-[var(--foreground)] border-[var(--accent)] text-[var(--background)] shadow-sm';
      case 'function':
        return 'bg-[var(--foreground)] border-[var(--secondary)] text-[var(--background)] shadow-sm';
      case 'trigger':
        return 'bg-[var(--foreground)] border-[var(--primary)] text-[var(--background)] shadow-sm';
      default:
        return 'bg-[var(--foreground)] border-[var(--border)] text-[var(--background)] shadow-sm';
    }
  };

  const getTypeIcon = (type: string, status?: StepStatus) => {
    if (status) {
      switch (status) {
        case 'running': return '⚡';
        case 'success': return '✅';
        case 'error': return '❌';
        case 'pending': return '⏸️';
      }
    }
    switch (type) {
      case 'initial': return '🎯';
      case 'prompt': return '💬';
      case 'agent-task': return '🤖';
      case 'transform': return '🔄';
      case 'human-in-the-loop': return '👤';
      case 'tool-call': return '🛠️';
      case 'custom-prompt': return '✨';
      case 'function': return '🧩';
      case 'trigger': return '🚀';
      default: return '⚙️';
    }
  };

  const colorClasses = getNodeColor(data.type, data.status);
  const icon = getTypeIcon(data.type, data.status);

  // Enhanced secondary info rendering
  let secondaryInfo: React.ReactNode = null;
  if (data.type === 'tool-call' && data.toolName) {
    secondaryInfo = (
      <div className="text-xs opacity-75 mb-2 px-2 py-1 bg-[var(--background)] text-[var(--foreground)] rounded-md truncate max-w-[200px]">
        {data.toolName}
      </div>
    );
  } else if (data.type === 'custom-prompt') {
    secondaryInfo = (
      <div className="text-xs opacity-75 mb-2 px-2 py-1 bg-[var(--background)] text-[var(--foreground)] rounded-md">
        Custom Prompt
      </div>
    );
  } else if (data.type === 'function' && data.functionLanguage) {
    secondaryInfo = (
      <div className="text-xs opacity-75 mb-2 px-2 py-1 bg-[var(--background)] text-[var(--foreground)] rounded-md">
        {data.functionLanguage === 'js' ? 'JavaScript' : 'Python'}
      </div>
    );
  } else if (data.type === 'transform') {
    secondaryInfo = (
      <div className="text-xs opacity-75 mb-2 px-2 py-1 bg-[var(--background)] text-[var(--foreground)] rounded-md">
        Transform Data
      </div>
    );
  } else if (data.type === 'human-in-the-loop') {
    secondaryInfo = (
      <div className="text-xs opacity-75 mb-2 px-2 py-1 bg-[var(--background)] text-[var(--foreground)] rounded-md">
        Human Review
      </div>
    );
  }

  // Template/Model info (always show if available)
  let modelInfo: React.ReactNode = null;
  if (data.modelName && data.type !== 'transform' && data.type !== 'trigger') {
    modelInfo = (
      <div className="text-xs font-mono opacity-70 px-2 py-1 bg-[var(--background)] text-[var(--foreground)] rounded-md truncate max-w-[220px] border border-[var(--border)]">
        {data.modelName}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'rounded-xl border-2 min-w-[160px] max-w-[240px] transition-all duration-200 hover:scale-105 px-4 py-3',
        colorClasses
      )}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        id="input" 
        className="w-3 h-3 !bg-[var(--muted-foreground)] border-2 border-[var(--background)]"
      />
      
      {/* Header with icon and step name */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {data.stepName || data.name}
          </div>
          {data.status && (
            <div className="text-xs mt-1">
              <span className="px-2 py-1 rounded-full bg-[var(--background)] text-[var(--foreground)] font-medium capitalize border border-[var(--border)]">
                {data.status}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Secondary info */}
      {secondaryInfo}
      
      {/* Model info */}
      {modelInfo}
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="output" 
        className="w-3 h-3 !bg-[var(--muted-foreground)] border-2 border-[var(--background)]"
      />
    </div>
  );
};

// Node types configuration
const nodeTypes = {
  workflowStep: WorkflowStepNode,
};

export const WorkflowVisualizer: React.FC<WorkflowVisualizerProps> = ({
  workflow,
  className,
  initialStepData,
  stepDisplayData,
  stepStatuses = {},
}) => {
  // Generate visualization data from props - PURE DISPLAY ONLY
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Add initial step node with enhanced styling
    nodes.push({
      id: 'initial',
      type: 'workflowStep',
      position: { x: 0, y: 0 },
      data: {
        stepName: initialStepData.stepName,
        templateName: initialStepData.templateName,
        type: 'initial',
        modelName: initialStepData.modelName,
        status: stepStatuses['initial'],
      },
    });

    // Add workflow step nodes with enhanced styling
    if (workflow.steps && workflow.steps.length > 0) {
      workflow.steps.forEach((step: WorkflowStep, index: number) => {
        const displayData = stepDisplayData[index] || {
          stepName: step.name || 'Unnamed Step',
          templateName: undefined,
          modelName: undefined,
          type: step.type,
        };

        nodes.push({
          id: step.id,
          type: 'workflowStep',
          position: { x: 0, y: 0 },
          data: {
            stepName: displayData.stepName,
            templateName: displayData.templateName,
            type: displayData.type,
            modelName: displayData.modelName,
            status: stepStatuses[step.id],
            toolName: displayData.toolName,
            functionLanguage: displayData.functionLanguage,
          },
        });

        // Create enhanced edges with better styling using CSS variables
        const sourceId = index === 0 ? 'initial' : workflow.steps[index - 1].id;
        
        // Get CSS variable colors based on source step type for color consistency
        const getEdgeColor = (sourceType: string) => {
          switch (sourceType) {
            case 'initial': return 'var(--primary)';
            case 'prompt': return 'var(--chart-1)';
            case 'agent-task': return 'var(--chart-2)';
            case 'transform': return 'var(--chart-3)';
            case 'human-in-the-loop': return 'var(--chart-4)';
            case 'tool-call': return 'var(--chart-5)';
            case 'custom-prompt': return 'var(--accent)';
            case 'function': return 'var(--secondary)';
            default: return 'var(--muted-foreground)';
          }
        };

        const sourceType = index === 0 ? 'initial' : workflow.steps[index - 1].type;
        const edgeColor = getEdgeColor(sourceType);

        edges.push({
          id: `${sourceId}-${step.id}`,
          source: sourceId,
          target: step.id,
          sourceHandle: 'output',
          targetHandle: 'input',
          type: 'smoothstep',
          animated: stepStatuses[step.id] === 'running',
          style: { 
            stroke: edgeColor,
            strokeWidth: stepStatuses[step.id] === 'running' ? 4 : 3,
            strokeDasharray: stepStatuses[step.id] === 'pending' ? '8,4' : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
            width: 20,
            height: 20,
          },
        });
      });
    }

    // Use improved layout with better spacing
    const layoutedNodes = getTreeLayout(nodes, edges, [260, 140]);
    return { nodes: layoutedNodes, edges };
  }, [workflow, initialStepData, stepDisplayData, stepStatuses]);

  // Show enhanced empty state if no steps
  if (!workflow.steps || workflow.steps.length === 0) {
    return (
      <div className={cn(
        'flex items-center justify-center h-full border-2 border-dashed border-[var(--border)] rounded-lg bg-[var(--background)]',
        className
      )}>
        <div className="text-center text-[var(--muted-foreground)] p-8">
          <div className="text-6xl mb-4 opacity-60">🔄</div>
          <div className="text-xl font-semibold mb-2">No workflow steps defined</div>
          <div className="text-sm opacity-75">Add steps in the Builder tab to see the workflow visualization</div>
        </div>
      </div>
    );
  }

  // ENHANCED REACT FLOW WITH BEAUTIFUL STYLING
  return (
    <div className={cn('h-full w-full relative bg-[var(--background)]', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 60,
          maxZoom: 1.5,
          minZoom: 0.3,
        }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        zoomOnScroll={true}
        panOnScroll={false}
        zoomOnDoubleClick={true}
        panOnDrag={true}
        className="bg-[var(--background)]"
      >
        <MiniMap 
          nodeColor={(node) => {
            if (node.data?.status) {
              switch (node.data.status) {
                case 'running': return 'var(--primary)';
                case 'success': return 'var(--chart-2)';
                case 'error': return 'var(--destructive)';
                case 'pending': return 'var(--muted-foreground)';
              }
            }
            switch (node.data?.type) {
              case 'initial': return 'var(--primary)';
              case 'prompt': return 'var(--chart-1)';
              case 'agent-task': return 'var(--chart-2)';
              case 'transform': return 'var(--chart-3)';
              case 'human-in-the-loop': return 'var(--chart-4)';
              case 'tool-call': return 'var(--chart-5)';
              case 'custom-prompt': return 'var(--accent)';
              case 'function': return 'var(--secondary)';
              default: return 'var(--muted-foreground)';
            }
          }}
          position="bottom-right"
          style={{ 
            width: 140, 
            height: 100,
            borderRadius: 8,
            border: '2px solid var(--border)',
            backgroundColor: 'var(--card)',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        />
        <Controls 
          position="top-left" 
          showInteractive={false}
          style={{
            borderRadius: 8,
            border: '2px solid var(--border)',
            backgroundColor: 'var(--card)',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        />
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={2} 
          color="var(--muted-foreground)"
          style={{ opacity: 0.2 }}
        />
      </ReactFlow>
    </div>
  );
}; 