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

// Enhanced template interface with all display data
interface EnhancedTemplate {
  id: string;
  name: string;
  type: 'prompt' | 'task';
}

interface WorkflowVisualizerProps {
  workflow: WorkflowTemplate;
  className?: string;
  // Enhanced templates with all data needed for display - NO STORE ACCESS NEEDED
  enhancedTemplates: EnhancedTemplate[];
}

const HORIZONTAL_SPACING = 300;

const WorkflowStepNode: React.FC<{ data: any }> = ({ data }) => {
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'trigger':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'prompt':
        return 'bg-green-100 border-green-300 text-green-900';
      case 'agent-task':
        return 'bg-purple-100 border-purple-300 text-purple-900';
      case 'human-in-the-loop':
        return 'bg-orange-100 border-orange-300 text-orange-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'trigger':
        return '🚀';
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
      'px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] max-w-[250px]',
      getNodeColor(data.type)
    )}>
      <Handle type="target" position={Position.Left} id="input" className="!bg-gray-600" />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{getTypeIcon(data.type)}</span>
        <span className="font-semibold text-sm capitalize">{data.type}</span>
      </div>
      
      <div className="text-sm font-medium mb-1 line-clamp-2">
        {data.name}
      </div>
      
      {data.modelName && (
        <div className="text-xs opacity-75 font-mono bg-white/50 px-2 py-1 rounded">
          {data.modelName}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} id="output" className="!bg-gray-600" />
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
  enhancedTemplates,
}) => {
  // Generate visualization data from props - PURE CALCULATION
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Add initial step node
    const getInitialStepName = () => {
      if (workflow.triggerType === 'custom' && workflow.triggerPrompt) {
        return workflow.triggerPrompt.length > 30 ? 
               workflow.triggerPrompt.slice(0, 30) + '...' : 
               workflow.triggerPrompt;
      } else if (workflow.triggerType === 'template' && workflow.triggerRef) {
        const template = enhancedTemplates.find(t => t.id === workflow.triggerRef && t.type === 'prompt');
        return template?.name || 'Prompt Template';
      } else if (workflow.triggerType === 'task' && workflow.triggerRef) {
        const task = enhancedTemplates.find(t => t.id === workflow.triggerRef && t.type === 'task');
        return task?.name || 'Agent Task';
      }
      return 'Initial Step';
    };

    nodes.push({
      id: 'trigger',
      type: 'workflowStep',
      position: { x: 0, y: 0 },
      data: {
        name: getInitialStepName(),
        type: 'trigger',
      },
    });

    // Add workflow step nodes
    if (workflow.steps && workflow.steps.length > 0) {
      workflow.steps.forEach((step: WorkflowStep, index: number) => {
        const nodeX = (index + 1) * HORIZONTAL_SPACING;
        const modelName = step.modelId ? step.modelId.split(' ')[0].split('(')[0] : undefined;

        // Get template name from enhanced templates
        const getDisplayName = () => {
          if (step.templateId) {
            const templateType = step.type === 'prompt' ? 'prompt' : 'task';
            const template = enhancedTemplates.find(t => t.id === step.templateId && t.type === templateType);
            return template?.name || step.name || `Unknown ${templateType}`;
          }
          return step.name || 'Unnamed Step';
        };

        nodes.push({
          id: step.id,
          type: 'workflowStep',
          position: { x: nodeX, y: 0 },
          data: {
            name: getDisplayName(),
            type: step.type,
            modelName: modelName,
          },
        });

        // Create edge
        const sourceId = index === 0 ? 'trigger' : workflow.steps[index - 1].id;
        edges.push({
          id: `${sourceId}-${step.id}`,
          source: sourceId,
          target: step.id,
          sourceHandle: 'output',
          targetHandle: 'input',
          type: 'smoothstep',
          animated: true,
          style: { 
            stroke: 'hsl(var(--primary))', 
            strokeWidth: 4,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'hsl(var(--primary))',
            width: 20,
            height: 20,
          },
        });
      });
    }

    return { nodes, edges };
  }, [workflow, enhancedTemplates]);

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
          maxZoom: 1.5,
          minZoom: 0.1,
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
            switch (node.data?.type) {
              case 'trigger': return '#3b82f6';
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