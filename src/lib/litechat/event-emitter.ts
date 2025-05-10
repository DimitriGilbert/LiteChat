// src/lib/litechat/event-emitter.ts
// FULL FILE
import mitt from "mitt";
import type { ModEventPayloadMap } from "@/types/litechat/modding";

export const emitter = mitt<ModEventPayloadMap>();
