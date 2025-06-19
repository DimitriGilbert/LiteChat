import { emitter } from "@/lib/litechat/event-emitter";
import { 
  workflowEvent, 
  type WorkflowEventPayloads, 
  type WorkflowEventMetadata,
  WORKFLOW_EVENT_PRIORITIES,
  compareEventPriority,
  createWorkflowEventMetadata
} from "@/types/litechat/events/workflow.events";

interface QueuedEvent {
  eventName: string;
  payload: any;
  metadata: WorkflowEventMetadata;
  timestamp: number;
}

/**
 * Workflow Event Manager - Ensures proper event ordering and prevents race conditions
 */
export class WorkflowEventManager {
  private eventQueue: Map<string, QueuedEvent[]> = new Map(); // Keyed by runId
  private processingRuns: Set<string> = new Set(); // Runs currently being processed
  private sequenceCounters: Map<string, number> = new Map(); // Sequence counters per run

  /**
   * Emit a workflow event with proper ordering and metadata
   */
  emit<T extends keyof WorkflowEventPayloads>(
    eventName: T,
    payload: WorkflowEventPayloads[T],
    runId?: string,
    priority?: 'low' | 'normal' | 'high' | 'critical'
  ): void {
    // Extract runId from payload if not provided
    const workflowRunId = runId || (payload as any).runId;
    
    if (!workflowRunId) {
      // Emit immediately if no runId (not workflow-specific)
      emitter.emit(eventName as any, payload);
      return;
    }

    // Get or create sequence number
    const sequence = this.getNextSequence(workflowRunId);
    
    // Create metadata if not present
    const metadata = (payload as any).metadata || createWorkflowEventMetadata(
      workflowRunId,
      priority || WORKFLOW_EVENT_PRIORITIES[eventName] || 'normal',
      sequence
    );

    // Add metadata to payload
    const enrichedPayload = {
      ...payload,
      metadata
    };

    const queuedEvent: QueuedEvent = {
      eventName,
      payload: enrichedPayload,
      metadata,
      timestamp: Date.now()
    };

    // Add to queue
    if (!this.eventQueue.has(workflowRunId)) {
      this.eventQueue.set(workflowRunId, []);
    }
    this.eventQueue.get(workflowRunId)!.push(queuedEvent);

    // Process queue for this run
    this.processEventQueue(workflowRunId);
  }

  /**
   * Process the event queue for a specific workflow run
   */
  private async processEventQueue(runId: string): Promise<void> {
    // Prevent concurrent processing for same run
    if (this.processingRuns.has(runId)) {
      return;
    }

    this.processingRuns.add(runId);

    try {
      const queue = this.eventQueue.get(runId);
      if (!queue || queue.length === 0) {
        return;
      }

      // Sort events by priority and sequence
      queue.sort((a, b) => {
        // First by priority
        const priorityDiff = compareEventPriority(a.metadata.priority, b.metadata.priority);
        if (priorityDiff !== 0) return priorityDiff;

        // Then by sequence number
        const aSeq = a.metadata.sequence || 0;
        const bSeq = b.metadata.sequence || 0;
        return aSeq - bSeq;
      });

      // Process events in order
      while (queue.length > 0) {
        const event = queue.shift()!;
        
        try {
          // Add small delay for proper ordering
          await new Promise(resolve => setTimeout(resolve, 1));
          
          // Emit the event
          emitter.emit(event.eventName as any, event.payload);
          
          console.log(`[WorkflowEventManager] Emitted ${event.eventName} for run ${runId} (seq: ${event.metadata.sequence}, priority: ${event.metadata.priority})`);
        } catch (error) {
          console.error(`[WorkflowEventManager] Error emitting event ${event.eventName}:`, error);
        }
      }

      // Clean up empty queue
      if (queue.length === 0) {
        this.eventQueue.delete(runId);
        this.sequenceCounters.delete(runId);
      }
    } finally {
      this.processingRuns.delete(runId);
    }
  }

  /**
   * Get the next sequence number for a workflow run
   */
  private getNextSequence(runId: string): number {
    const current = this.sequenceCounters.get(runId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(runId, next);
    return next;
  }

  /**
   * Clear all events for a workflow run (useful for cancellation)
   */
  clearRunEvents(runId: string): void {
    this.eventQueue.delete(runId);
    this.sequenceCounters.delete(runId);
    console.log(`[WorkflowEventManager] Cleared all events for run ${runId}`);
  }

  /**
   * Get pending event count for a workflow run
   */
  getPendingEventCount(runId: string): number {
    return this.eventQueue.get(runId)?.length || 0;
  }

  /**
   * Check if a workflow run has events being processed
   */
  isProcessingRun(runId: string): boolean {
    return this.processingRuns.has(runId);
  }
}

// Export singleton instance
export const workflowEventManager = new WorkflowEventManager(); 