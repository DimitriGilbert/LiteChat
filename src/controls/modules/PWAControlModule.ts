import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import { PWAService } from "@/services/pwa.service";
import { PWAUpdateNotification } from "@/components/LiteChat/common/PWAUpdateNotification";
import { emitter } from "@/lib/litechat/event-emitter";
import { pwaEvent } from "@/types/litechat/events/pwa.events";
import { Button } from "@/components/ui/button";
import { DownloadIcon, RotateCcw } from "lucide-react";
import React from "react";
import i18next from "i18next";
import type { ControlModuleConstructor } from "@/types/litechat/control";

export class PWAControlModule implements ControlModule {
  readonly id = "core-pwa-control";
  private unregisterCallbacks: (() => void)[] = [];
  private pwaService: PWAService | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    this.pwaService = PWAService.getInstance();

    // Initialize PWA service
    await PWAService.initialize();

    // Setup event listeners
    this.setupEventListeners();

    console.log(`[${this.id}] PWA Control Module initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    // Register PWA update notification as a general control
    const unregisterNotification = modApi.registerChatControl({
      id: "pwa-update-notification",
      panel: "main",
      renderer: () => React.createElement(PWAUpdateNotification),
    });

    // Register PWA status/update button in header
    const unregisterUpdateButton = modApi.registerChatControl({
      id: "pwa-update-button",
      panel: "header",
      renderer: () => React.createElement(this.createUpdateButton()),
    });

    // Register PWA settings tab
    const unregisterSettingsTab = modApi.registerSettingsTab({
      id: "pwa",
      title: i18next.t("controls:settings.tabs.pwa"),
      component: this.createPWASettingsComponent(),
      order: 90,
    });

    this.unregisterCallbacks.push(
      unregisterNotification,
      unregisterUpdateButton,
      unregisterSettingsTab
    );

    console.log(`[${this.id}] PWA controls registered.`);
  }

  destroy(): void {
    this.unregisterCallbacks.forEach((callback) => callback());
    this.unregisterCallbacks = [];
    console.log(`[${this.id}] PWA Control Module destroyed.`);
  }

  private setupEventListeners(): void {
    // Listen for PWA events and handle them
    emitter.on(pwaEvent.updateAvailable, (payload) => {
      console.log("[PWA] Update available:", payload);
    });

    emitter.on(pwaEvent.updateInstalled, (payload) => {
      console.log("[PWA] Update installed:", payload);
    });

    emitter.on(pwaEvent.updateError, (payload) => {
      console.error("[PWA] Update error:", payload);
    });
  }

  private createUpdateButton(): React.ComponentType<any> {
    const pwaService = this.pwaService;

    const PWAUpdateButton: React.FC = () => {
      const [isUpdateAvailable, setIsUpdateAvailable] = React.useState(false);
      const [isUpdating, setIsUpdating] = React.useState(false);
      const [isOfflineReady, setIsOfflineReady] = React.useState(false);

      React.useEffect(() => {
        if (!pwaService) return;

        // Check initial state
        setIsUpdateAvailable(pwaService.isUpdateAvailable());
        setIsOfflineReady(pwaService.isOfflineReady());

        // Define handlers
        const handleUpdateAvailable = () => setIsUpdateAvailable(true);
        const handleUpdateAccepted = () => setIsUpdating(true);
        const handleUpdateInstalled = () => {
          setIsUpdating(false);
          setIsUpdateAvailable(false);
        };
        const handleOfflineReady = () => setIsOfflineReady(true);

        // Listen for update events
        emitter.on(pwaEvent.updateAvailable, handleUpdateAvailable);
        emitter.on(pwaEvent.updateAccepted, handleUpdateAccepted);
        emitter.on(pwaEvent.updateInstalled, handleUpdateInstalled);
        emitter.on(pwaEvent.offlineReady, handleOfflineReady);

        return () => {
          emitter.off(pwaEvent.updateAvailable, handleUpdateAvailable);
          emitter.off(pwaEvent.updateAccepted, handleUpdateAccepted);
          emitter.off(pwaEvent.updateInstalled, handleUpdateInstalled);
          emitter.off(pwaEvent.offlineReady, handleOfflineReady);
        };
      }, []);

      const handleUpdateClick = async () => {
        if (!pwaService) return;
        await pwaService.acceptUpdate();
      };

      const handleCheckForUpdates = async () => {
        if (!pwaService) return;
        await pwaService.checkForUpdates();
      };

      if (!isUpdateAvailable && !isOfflineReady) return null;

      return React.createElement(
        "div",
        { className: "flex items-center space-x-2" },
        isUpdateAvailable &&
          React.createElement(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: handleUpdateClick,
              disabled: isUpdating,
              className: "h-8 px-3 text-xs",
            },
            isUpdating
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(RotateCcw, {
                    className: "h-3 w-3 mr-1 animate-spin",
                  }),
                  "Updating..."
                )
              : React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(DownloadIcon, {
                    className: "h-3 w-3 mr-1",
                  }),
                  "Update"
                )
          ),
        isOfflineReady &&
          !isUpdateAvailable &&
          React.createElement(
            Button,
            {
              variant: "ghost",
              size: "sm",
              onClick: handleCheckForUpdates,
              className: "h-8 px-3 text-xs",
            },
            React.createElement(RotateCcw, { className: "h-3 w-3 mr-1" }),
            "Check Updates"
          )
      );
    };

    return PWAUpdateButton;
  }

  private createPWASettingsComponent(): React.ComponentType<any> {
    const pwaService = this.pwaService;

    const PWASettings: React.FC = () => {
      const [isUpdateAvailable, setIsUpdateAvailable] = React.useState(false);
      const [isOfflineReady, setIsOfflineReady] = React.useState(false);

      React.useEffect(() => {
        if (!pwaService) return;

        setIsUpdateAvailable(pwaService.isUpdateAvailable());
        setIsOfflineReady(pwaService.isOfflineReady());
      }, []);

      const handleCheckForUpdates = async () => {
        if (!pwaService) return;
        await pwaService.checkForUpdates();
      };

      const handleAcceptUpdate = async () => {
        if (!pwaService) return;
        await pwaService.acceptUpdate();
      };

      return React.createElement(
        "div",
        { className: "p-4 space-y-6" },
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(
            "h3",
            { className: "text-lg font-medium" },
            "PWA Status"
          ),
          React.createElement(
            "div",
            { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
            React.createElement(
              "div",
              { className: "p-3 border rounded-lg" },
              React.createElement(
                "div",
                { className: "flex items-center justify-between" },
                React.createElement(
                  "span",
                  { className: "text-sm font-medium" },
                  "Offline Ready"
                ),
                React.createElement(
                  "span",
                  {
                    className: `text-xs px-2 py-1 rounded ${
                      isOfflineReady
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`,
                  },
                  isOfflineReady ? "Yes" : "No"
                )
              ),
              React.createElement(
                "p",
                { className: "text-xs text-muted-foreground mt-1" },
                "App can work without internet connection"
              )
            ),
            React.createElement(
              "div",
              { className: "p-3 border rounded-lg" },
              React.createElement(
                "div",
                { className: "flex items-center justify-between" },
                React.createElement(
                  "span",
                  { className: "text-sm font-medium" },
                  "Update Available"
                ),
                React.createElement(
                  "span",
                  {
                    className: `text-xs px-2 py-1 rounded ${
                      isUpdateAvailable
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`,
                  },
                  isUpdateAvailable ? "Yes" : "No"
                )
              ),
              React.createElement(
                "p",
                { className: "text-xs text-muted-foreground mt-1" },
                "New version ready to install"
              )
            )
          )
        ),
        React.createElement(
          "div",
          { className: "space-y-3" },
          React.createElement(
            "h4",
            { className: "text-md font-medium" },
            "Actions"
          ),
          React.createElement(
            "div",
            { className: "flex space-x-2" },
            React.createElement(
              Button,
              {
                variant: "outline",
                size: "sm",
                onClick: handleCheckForUpdates,
              },
              React.createElement(RotateCcw, { className: "h-4 w-4 mr-2" }),
              "Check for Updates"
            ),
            isUpdateAvailable &&
              React.createElement(
                Button,
                {
                  size: "sm",
                  onClick: handleAcceptUpdate,
                },
                React.createElement(DownloadIcon, {
                  className: "h-4 w-4 mr-2",
                }),
                "Install Update"
              )
          )
        ),
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(
            "h4",
            { className: "text-md font-medium" },
            "About PWA"
          ),
          React.createElement(
            "p",
            { className: "text-sm text-muted-foreground" },
            "Progressive Web App (PWA) features enable LiteChat to work offline and receive automatic updates. When an update is available, you'll see a notification with the option to install it immediately or postpone it."
          )
        )
      );
    };

    return PWASettings;
  }
}

(PWAControlModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.pwa": "PWA & Updates",
    },
  },
  fr: {
    controls: {
      "settings.tabs.pwa": "PWA & Mises à jour",
    },
  },
};
