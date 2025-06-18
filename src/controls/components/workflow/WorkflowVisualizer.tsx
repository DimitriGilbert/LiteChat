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

import '@xyflow/react/dist/style.css';

// Step data that the visualizer receives - STATIC DISPLAY ONLY
interface StepDisplayData {
  stepName: string;
  templateName?: string;
  modelName?: string;
  type: string;
  status?: StepStatus;
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

const HORIZONTAL_SPACING = 400;

const WorkflowStepNode: React.FC<{ data: any }> = ({ data }) => {
  const getNodeColor = (type: string, status?: StepStatus) => {
    // Status-based colors take priority (with glow)
    if (status) {
      switch (status) {
        case 'running':
          return 'bg-blue-50 border-blue-400 text-blue-900 shadow-lg shadow-blue-200';
        case 'success':
          return 'bg-green-50 border-green-400 text-green-900 shadow-lg shadow-green-200';
        case 'error':
          return 'bg-red-50 border-red-400 text-red-900 shadow-lg shadow-red-200';
        case 'pending':
          return 'bg-gray-50 border-gray-300 text-gray-700 shadow-lg shadow-gray-200';
      }
    }

    // Default type-based colors (minimal shadow when no status)
    switch (type) {
      case 'initial':
        return 'bg-indigo-100 border-indigo-400 text-indigo-900 shadow-sm';
      case 'prompt':
        return 'bg-green-100 border-green-400 text-green-900 shadow-sm';
      case 'agent-task':
        return 'bg-purple-100 border-purple-400 text-purple-900 shadow-sm';
      case 'human-in-the-loop':
        return 'bg-orange-100 border-orange-400 text-orange-900 shadow-sm';
      default:
        return 'bg-gray-100 border-gray-400 text-gray-900 shadow-sm';
    }
  };

  const getTypeIcon = (type: string, status?: StepStatus) => {
    // Status-based icons take priority
    if (status) {
      switch (status) {
        case 'running':
          return '⏳';
        case 'success':
          return '✅';
        case 'error':
          return '❌';
        case 'pending':
          return '⏸️';
      }
    }

    // Default type-based icons
    switch (type) {
      case 'initial':
        return '🎯';
      case 'prompt':
        return '💬';
      case 'agent-task':
        return '🤖';
      case 'human-in-the-loop':
        return '👤';
      default:
        return '⚙️';
    }
  };

  return (
    <div className={cn(
      'px-4 py-3 rounded-lg border-2 min-w-[200px] max-w-[280px]',
      getNodeColor(data.type, data.status)
    )}>
      <Handle type="target" position={Position.Left} id="input" className="!bg-gray-700" />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{getTypeIcon(data.type, data.status)}</span>
        <span className="font-semibold text-sm">{data.stepName || data.name}</span>
        {data.status && (
          <span className="text-xs px-2 py-1 rounded-full bg-white/60 font-medium capitalize">
            {data.status}
          </span>
        )}
      </div>
      
      {data.templateName && (
        <div className="text-sm font-medium mb-1 text-slate-700">
          {data.templateName}
        </div>
      )}
      
      {data.modelName && (
        <div className="text-xs opacity-75 font-mono bg-white/50 px-2 py-1 rounded">
          {data.modelName}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} id="output" className="!bg-gray-700" />
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

    // Add initial step node with data from props
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

    // Add workflow step nodes with data from props
    if (workflow.steps && workflow.steps.length > 0) {
      workflow.steps.forEach((step: WorkflowStep, index: number) => {
        const nodeX = (index + 1) * HORIZONTAL_SPACING;
        const displayData = stepDisplayData[index] || {
          stepName: step.name || 'Unnamed Step',
          templateName: undefined,
          modelName: undefined,
          type: step.type,
        };

        nodes.push({
          id: step.id,
          type: 'workflowStep',
          position: { x: nodeX, y: 0 },
          data: {
            stepName: displayData.stepName,
            templateName: displayData.templateName,
            type: displayData.type,
            modelName: displayData.modelName,
            status: stepStatuses[step.id],
          },
        });

        // Create edge with better contrast
        const sourceId = index === 0 ? 'initial' : workflow.steps[index - 1].id;
        edges.push({
          id: `${sourceId}-${step.id}`,
          source: sourceId,
          target: step.id,
          sourceHandle: 'output',
          targetHandle: 'input',
          type: 'smoothstep',
          animated: true,
          style: { 
            stroke: '#1f2937', // Much darker gray for better contrast
            strokeWidth: 3,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#1f2937',
            width: 18,
            height: 18,
          },
        });
      });
    }

    return { nodes, edges };
  }, [workflow, initialStepData, stepDisplayData, stepStatuses]);

  // Show empty state if no steps
  if (!workflow.steps || workflow.steps.length === 0) {
    return (
      <div className={cn(
        'flex items-center justify-center h-full border-2 border-dashed border-border rounded-lg',
        className
      )}>
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-2">📋</div>
          <div className="text-lg font-medium">No workflow steps</div>
          <div className="text-sm">Add steps to see the workflow visualization</div>
        </div>
      </div>
    );
  }

  // INTERACTIVE REACT FLOW WITH STATIC DATA
  return (
    <div className={cn('h-full w-full relative', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 50,
          maxZoom: 2.25, // 1.5 * 1.5 = 50% closer
          minZoom: 0.15, // 0.1 * 1.5 = 50% closer
        }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        zoomOnScroll={true}
        panOnScroll={false}
        zoomOnDoubleClick={true}
        panOnDrag={true}
        className="bg-background"
      >
        <MiniMap 
          nodeColor={(node) => {
            if (node.data?.status) {
              switch (node.data.status) {
                case 'running': return '#3b82f6';
                case 'success': return '#10b981';
                case 'error': return '#ef4444';
                case 'pending': return '#6b7280';
              }
            }
            switch (node.data?.type) {
              case 'initial': return '#6366f1';
              case 'prompt': return '#10b981';
              case 'agent-task': return '#8b5cf6';
              case 'human-in-the-loop': return '#f59e0b';
              default: return '#6b7280';
            }
          }}
          position="bottom-right"
          style={{ width: 120, height: 80 }}
        />
        <Controls position="top-left" showInteractive={false} />
        <Background variant={BackgroundVariant.Dots} gap={20} size={2} />
      </ReactFlow>
    </div>
  );
}; 