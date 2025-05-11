// src/lib/litechat/event-emitter.ts
// FULL FILE
import mitt, { type Emitter, type EventType } from "mitt"; // Import Emitter and EventType
import type { ModEventPayloadMap } from "@/types/litechat/modding";

// Ensure ModEventPayloadMap is compatible with Record<EventType, any>
// This explicitly tells mitt that our event names (which are strings) map to some payload.
export const emitter: Emitter<ModEventPayloadMap & Record<EventType, any>> =
  mitt<ModEventPayloadMap & Record<EventType, any>>();
