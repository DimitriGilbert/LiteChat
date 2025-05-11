// src/components/LiteChat/common/ModalManager.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { useControlRegistryStore } from "@/store/control.store";
import type { ModalProviderProps } from "@/types/litechat/modding";

interface ActiveModal {
  modalId: string;
  isOpen: boolean;
  modalProps?: any;
  targetId?: string | null;
  initialTab?: string | null;
  initialSubTab?: string | null;
}

export const ModalManager: React.FC = () => {
  const [activeModals, setActiveModals] = useState<Record<string, ActiveModal>>(
    {}
  );
  const modalProviders = useControlRegistryStore(
    // Use the hook for reactivity
    (state) => state.modalProviders
  );

  useEffect(() => {
    const handleOpenRequest = (payload: {
      modalId: string;
      targetId?: string | null;
      initialTab?: string | null;
      initialSubTab?: string | null;
      modalProps?: any;
    }) => {
      setActiveModals((prev) => ({
        ...prev,
        [payload.modalId]: { ...payload, isOpen: true },
      }));
      emitter.emit(uiEvent.modalStateChanged, { ...payload, isOpen: true });
    };

    const handleCloseRequest = (payload: { modalId: string }) => {
      setActiveModals((prev) => {
        const newState = { ...prev };
        if (newState[payload.modalId]) {
          newState[payload.modalId].isOpen = false;
        }
        return newState;
      });
      emitter.emit(uiEvent.modalStateChanged, {
        modalId: payload.modalId,
        isOpen: false,
      });
    };

    emitter.on(uiEvent.openModalRequest, handleOpenRequest);
    emitter.on(uiEvent.closeModalRequest, handleCloseRequest);

    return () => {
      emitter.off(uiEvent.openModalRequest, handleOpenRequest);
      emitter.off(uiEvent.closeModalRequest, handleCloseRequest);
    };
  }, []);

  return (
    <>
      {Object.entries(activeModals).map(([id, modalState]) => {
        if (!modalState.isOpen) return null;
        const ProviderComponent = modalProviders[id];
        if (!ProviderComponent) {
          console.warn(`[ModalManager] No provider for modalId: ${id}`);
          return null;
        }
        const props: ModalProviderProps = {
          isOpen: true,
          onClose: () =>
            emitter.emit(uiEvent.closeModalRequest, { modalId: id }),
          modalProps: modalState.modalProps,
          targetId: modalState.targetId,
          initialTab: modalState.initialTab,
          initialSubTab: modalState.initialSubTab,
        };
        return <ProviderComponent key={id} {...props} />;
      })}
    </>
  );
};
