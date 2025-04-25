import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { PromptControl } from "@/types/litechat/prompt";
import type { ChatControl } from "@/types/litechat/chat";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/types/litechat/modding";

interface RegisteredMiddleware<H extends ModMiddlewareHookName> {
  modId: string;
  callback: (
    payload: ModMiddlewarePayloadMap[H],
  ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>;
  order?: number;
}
type MiddlewareRegistry = {
  [H in ModMiddlewareHookName]?: RegisteredMiddleware<H>[];
};

interface ControlState {
  promptControls: Record<string, PromptControl>;
  chatControls: Record<string, ChatControl>;
  middlewareRegistry: MiddlewareRegistry;
}
interface ControlActions {
  registerPromptControl: (control: PromptControl) => () => void;
  unregisterPromptControl: (id: string) => void;
  registerChatControl: (control: ChatControl) => () => void;
  unregisterChatControl: (id: string) => void;
  registerMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"],
    order?: number,
  ) => () => void;
  unregisterMiddleware: <H extends ModMiddlewareHookName>(
    hookName: H,
    modId: string,
    callback: RegisteredMiddleware<H>["callback"],
  ) => void;
  getMiddlewareForHook: <H extends ModMiddlewareHookName>(
    hookName: H,
  ) => RegisteredMiddleware<H>[];
}

export const useControlRegistryStore = create(
  immer<ControlState & ControlActions>((set, get) => ({
    promptControls: {},
    chatControls: {},
    middlewareRegistry: {},
    registerPromptControl: (c) => {
      set((s) => {
        s.promptControls[c.id] = c;
      });
      return () => get().unregisterPromptControl(c.id);
    },
    unregisterPromptControl: (id) => {
      set((s) => {
        delete s.promptControls[id];
      });
    },
    registerChatControl: (c) => {
      set((s) => {
        s.chatControls[c.id] = c;
      });
      return () => get().unregisterChatControl(c.id);
    },
    unregisterChatControl: (id) => {
      set((s) => {
        delete s.chatControls[id];
      });
    },
    registerMiddleware: (hN, mId, cb, o = 0) => {
      const reg: RegisteredMiddleware<any> = {
        modId: mId,
        callback: cb,
        order: o,
      };
      set((s) => {
        if (!s.middlewareRegistry[hN]) s.middlewareRegistry[hN] = [];
        (s.middlewareRegistry[hN] as RegisteredMiddleware<any>[]).push(reg);
        (s.middlewareRegistry[hN] as RegisteredMiddleware<any>[]).sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
      });
      return () => get().unregisterMiddleware(hN, mId, cb);
    },
    unregisterMiddleware: (hN, mId, cb) => {
      set((s) => {
        if (s.middlewareRegistry[hN]) {
          s.middlewareRegistry[hN] = (
            s.middlewareRegistry[hN] as RegisteredMiddleware<any>[]
          ).filter((reg) => !(reg.modId === mId && reg.callback === cb));
          if (s.middlewareRegistry[hN]?.length === 0)
            delete s.middlewareRegistry[hN];
        }
      });
    },
    getMiddlewareForHook: (hN) =>
      [...(get().middlewareRegistry[hN] ?? [])] as RegisteredMiddleware<any>[],
  })),
);
