// src/lib/litechat/event-emitter.ts
// FULL FILE
import mitt from "mitt";
import type { ModEventPayloadMap } from "@/types/litechat/modding";

// Use the mapped type directly
export const emitter = mitt<ModEventPayloadMap>();
