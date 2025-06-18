import type { FlowContentGenerator, FlowData, FlowNode, FlowEdge, StepStatus } from "@/types/litechat/flow";
import type { WorkflowRun, WorkflowStep } from "@/types/litechat/workflow";
import { usePromptTemplateStore } from "@/store/prompt-template.store";
import { useProviderStore } from "@/store/provider.store";


export class WorkflowFlowGenerator implements FlowContentGenerator {
  generateInitialFlow(run: WorkflowRun): string {
    console.log(`[WorkflowFlowGenerator] Generating initial flow for run:`, {
      runId: run.runId,
      templateName: run.template.name,
      stepCount: run.template.steps.length,
    });

    const flowData: FlowData = {
      type: 'workflow',
      name: run.template.name,
      nodes: [
        {
          id: 'initial',
          type: 'trigger',
          label: 'User Input',
          position: { x: 0, y: 0 },
          status: 'running',
          data: {
            modelName: 'Default Model',
            templateName: 'Initial Processing'
          }
        },
        ...run.template.steps.map((step: WorkflowStep, index: number) => ({
          id: step.id,
          type: step.type,
          label: step.name || `Step ${index + 1}`,
          position: { x: (index + 1) * 400, y: 0 },
          status: 'pending' as const,
          data: {
            modelName: this.getModelName(step.modelId),
            templateName: this.getTemplateName(step.templateId)
          }
        }))
      ],
      edges: this.generateEdges(run.template.steps),
      metadata: {
        runId: run.runId,
        startedAt: run.startedAt,
        currentStep: 'initial',
        totalSteps: run.template.steps.length
      }
    };

    const jsonString = JSON.stringify(flowData, null, 2);
    console.log(`[WorkflowFlowGenerator] Generated flow JSON:`, {
      jsonLength: jsonString.length,
      nodeCount: flowData.nodes.length,
      edgeCount: flowData.edges.length,
      jsonPreview: jsonString.substring(0, 300) + (jsonString.length > 300 ? '...' : ''),
    });

    return jsonString;
  }

  updateNodeStatus(content: string, nodeId: string, status: StepStatus): string {
    try {
      const flowData: FlowData = JSON.parse(content);
      
      // Update the specific node status
      const nodeIndex = flowData.nodes.findIndex(node => node.id === nodeId);
      if (nodeIndex !== -1) {
        flowData.nodes[nodeIndex] = {
          ...flowData.nodes[nodeIndex],
          status
        };
        
        // Update edge animations based on status
        flowData.edges = flowData.edges.map(edge => ({
          ...edge,
          animated: this.shouldAnimateEdge(edge, flowData.nodes)
        }));
        
        // Update metadata
        if (flowData.metadata) {
          flowData.metadata.currentStep = nodeId;
          flowData.metadata.lastUpdated = new Date().toISOString();
        }
      }
      
      return JSON.stringify(flowData, null, 2);
    } catch (error) {
      console.error('Failed to update node status:', error);
      return content; // Return original content if parsing fails
    }
  }

  addStepOutput(content: string, nodeId: string, output: any): string {
    try {
      const flowData: FlowData = JSON.parse(content);
      
      // Update the specific node with output data
      const nodeIndex = flowData.nodes.findIndex(node => node.id === nodeId);
      if (nodeIndex !== -1) {
        flowData.nodes[nodeIndex] = {
          ...flowData.nodes[nodeIndex],
          data: {
            ...flowData.nodes[nodeIndex].data,
            output: output,
            hasOutput: true
          }
        };
        
        if (flowData.metadata) {
          if (!flowData.metadata.stepOutputs) {
            flowData.metadata.stepOutputs = {};
          }
          flowData.metadata.stepOutputs[nodeId] = output;
        }
      }
      
      return JSON.stringify(flowData, null, 2);
    } catch (error) {
      console.error('Failed to add step output:', error);
      return content;
    }
  }

  finalizeWorkflow(content: string, finalOutput: Record<string, any>): string {
    try {
      const flowData: FlowData = JSON.parse(content);
      
      // Mark all nodes as completed
      flowData.nodes = flowData.nodes.map(node => ({
        ...node,
        status: node.status === 'error' ? 'error' : 'success'
      }));
      
      // Remove edge animations
      flowData.edges = flowData.edges.map(edge => ({
        ...edge,
        animated: false
      }));
      
      // Update metadata
      if (flowData.metadata) {
        flowData.metadata.status = 'completed';
        flowData.metadata.completedAt = new Date().toISOString();
        flowData.metadata.finalOutput = finalOutput;
      }
      
      return JSON.stringify(flowData, null, 2);
    } catch (error) {
      console.error('Failed to finalize workflow:', error);
      return content;
    }
  }

  private getModelName(modelId?: string): string {
    if (!modelId) return 'Default Model';
    
    try {
      const providerState = useProviderStore.getState();
      const models = providerState.getGloballyEnabledModelDefinitions();
      const model = models.find((m) => m.id === modelId);
      return model?.name || modelId;
    } catch (error) {
      return modelId;
    }
  }

  private getTemplateName(templateId?: string): string {
    if (!templateId) return 'No Template';
    
    try {
      const { promptTemplates } = usePromptTemplateStore.getState();
      const template = promptTemplates.find(t => t.id === templateId);
      return template?.name || 'Unknown Template';
    } catch (error) {
      return 'Unknown Template';
    }
  }

  private generateEdges(steps: WorkflowStep[]): FlowEdge[] {
    const edges: FlowEdge[] = [];
    
    // Edge from initial to first step
    if (steps.length > 0) {
      edges.push({
        id: `initial-${steps[0].id}`,
        source: 'initial',
        target: steps[0].id,
        animated: true, // Initial edge is animated
        type: 'smoothstep',
        style: { 
          stroke: '#1f2937',
          strokeWidth: 2,
        }
      });
    }
    
    // Edges between sequential steps
    for (let i = 0; i < steps.length - 1; i++) {
      const sourceStep = steps[i];
      const targetStep = steps[i + 1];
      
      edges.push({
        id: `${sourceStep.id}-${targetStep.id}`,
        source: sourceStep.id,
        target: targetStep.id,
        animated: false, // Will be updated based on status
        type: 'smoothstep',
        style: { 
          stroke: '#1f2937',
          strokeWidth: 2,
        }
      });
    }
    
    return edges;
  }

  private shouldAnimateEdge(edge: FlowEdge, nodes: FlowNode[]): boolean {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    // Animate if source is running or completed and target is running
    return (
      (sourceNode?.status === 'running') ||
      (sourceNode?.status === 'success' && targetNode?.status === 'running')
    );
  }

  // Utility method to create flow content from current workflow state
  createFlowFromWorkflowState(run: WorkflowRun, stepStatuses: Record<string, StepStatus>): string {
    const flowData: FlowData = {
      type: 'workflow',
      name: run.template.name,
      nodes: [
                 {
           id: 'initial',
           type: 'trigger',
           label: 'User Input',
           position: { x: 0, y: 0 },
           status: stepStatuses['initial'] || 'completed',
           data: {
             modelName: 'Default Model',
             templateName: 'Initial Processing'
           }
         },
        ...run.template.steps.map((step: WorkflowStep, index: number) => ({
          id: step.id,
          type: step.type,
          label: step.name || `Step ${index + 1}`,
          position: { x: (index + 1) * 400, y: 0 },
          status: stepStatuses[step.id] || 'pending',
          data: {
            modelName: this.getModelName(step.modelId),
            templateName: this.getTemplateName(step.templateId)
          }
        }))
      ],
      edges: [],
      metadata: {
        runId: run.runId,
        startedAt: run.startedAt,
        currentStep: run.currentStepIndex >= 0 ? run.template.steps[run.currentStepIndex]?.id : 'initial',
        totalSteps: run.template.steps.length,
        stepOutputs: run.stepOutputs
      }
    };

    // Generate edges with proper animation
    flowData.edges = this.generateEdges(run.template.steps).map(edge => ({
      ...edge,
      animated: this.shouldAnimateEdge(edge, flowData.nodes)
    }));

    return JSON.stringify(flowData, null, 2);
  }
} 