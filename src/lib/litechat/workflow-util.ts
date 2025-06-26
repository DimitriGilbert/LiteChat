import type { WorkflowRun } from "@/types/litechat/workflow";

/**
 * Builds the context object for a transform or function step.
 * This provides the step with access to the initial trigger data and all previous step outputs.
 */
export async function buildTransformContext(
  run: WorkflowRun,
  currentStepIndex: number
): Promise<Record<string, any>> {
  const triggerStep = run.template.steps[0];
  const initialStepOutput = run.stepOutputs[triggerStep.id] || {};

  const previousOutputs = run.template.steps
    .slice(0, currentStepIndex)
    .map((step, index) => ({
      id: step.id,
      name: step.name,
      type: step.type,
      index: index,
      output: run.stepOutputs[step.id] || null,
    }));

  return {
    workflow: {
      runId: run.runId,
      templateId: run.template.id,
      templateName: run.template.name,
    },
    initial_step: {
      id: triggerStep.id,
      name: triggerStep.name,
      output: initialStepOutput,
    },
    outputs: previousOutputs,
  };
} 