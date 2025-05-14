// src/controls/modules/ProviderSettingsModule.ts
// FULL FILE
import React from "react";
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { SettingsProviders } from "@/controls/components/provider-settings/SettingsProviders";
import { providerEvent } from "@/types/litechat/events/provider.events";

export class ProviderSettingsModule implements ControlModule {
  readonly id = "core-provider-settings";
  private modApiRef: LiteChatModApi | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  // No need for notifyComponentUpdate if SettingsProviders fetches its own data

  // These are no longer needed as public members if SettingsProviders fetches its own data
  // public enabledAndOrderedModels: ModelListItem[] = [];
  // public dbProviderConfigs: DbProviderConfig[] = [];
  // public isLoadingProviders = true;

  async initialize(modApi: LiteChatModApi): Promise<void> {
    this.modApiRef = modApi;
    // No need to load initial state here if sub-components fetch their own
    // this.loadInitialState();

    // Subscriptions might still be useful if the module needs to react to something,
    // but not for directly passing data to SettingsProviders if it's store-aware.
  }

  // private loadInitialState() {
  //   const providerState = useProviderStore.getState();
  //   this.enabledAndOrderedModels =
  //     providerState.getGloballyEnabledModelDefinitions();
  //   this.dbProviderConfigs = providerState.dbProviderConfigs;
  //   this.isLoadingProviders = providerState.isLoading;
  // }

  public setGlobalModelSortOrderFromModule = (ids: string[]) => {
    // This method is passed to GlobalModelOrganizer via SettingsProviders
    this.modApiRef?.emit(providerEvent.setGlobalModelSortOrderRequest, { ids });
  };

  // public setNotifyCallback = (cb: (() => void) | null) => {
  //   this.notifyComponentUpdate = cb;
  // };

  register(modApi: LiteChatModApi): void {
    this.modApiRef = modApi;
    modApi.registerSettingsTab({
      id: "providers",
      title: "Providers & Models",
      order: 20,
      component: () =>
        // SettingsProviders will fetch its own data from the store.
        // We only need to pass the action for setting sort order to GlobalModelOrganizer.
        React.createElement(SettingsProviders, {
          setGlobalModelSortOrderFromModule:
            this.setGlobalModelSortOrderFromModule,
        }),
    });
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    // this.notifyComponentUpdate = null;
    this.modApiRef = null;
  }
}
