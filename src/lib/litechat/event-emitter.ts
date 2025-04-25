import mitt from "mitt";
import type {
  ModEventPayloadMap,
  ModEventName,
} from "@/types/litechat/modding";
type EmitterEvents = {
  [K in ModEventName]: K extends keyof ModEventPayloadMap
    ? ModEventPayloadMap[K]
    : unknown;
};
export const emitter = mitt<EmitterEvents>();
