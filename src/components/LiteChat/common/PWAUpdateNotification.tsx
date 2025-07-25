import type React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DownloadIcon, X, RotateCcw } from "lucide-react";
import { PWAService } from "@/services/pwa.service";
import { emitter } from "@/lib/litechat/event-emitter";
import { pwaEvent } from "@/types/litechat/events/pwa.events";
import { toast } from "sonner";

interface PWAUpdateNotificationProps {
  onClose?: () => void;
  autoHide?: boolean;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export const PWAUpdateNotification: React.FC<PWAUpdateNotificationProps> = ({
  onClose,
  // autoHide = true,
  position = "top-right",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSW, setUpdateSW] = useState<(() => Promise<void>) | null>(null);
  const [isOfflineReady, setIsOfflineReady] = useState(false);

  useEffect(() => {
    const pwaService = PWAService.getInstance();

    // Check initial state
    setIsOfflineReady(pwaService.isOfflineReady());

    // Listen for update events
    emitter.on(
      pwaEvent.updateAvailable,
      (payload) => {
        setUpdateSW(() => payload.updateSW);
        setIsVisible(true);
      }
    );

    emitter.on(
      pwaEvent.updateAccepted,
      () => {
        setIsUpdating(true);
      }
    );

    emitter.on(
      pwaEvent.updateInstalled,
      () => {
        setIsUpdating(false);
        setIsVisible(false);
        toast.success("Update Installed", {
          description: "LiteChat has been updated successfully!",
        });
      }
    );

    emitter.on(
      pwaEvent.updateError,
      (payload) => {
        setIsUpdating(false);
        console.error("PWA Update Error:", payload.error);
      }
    );

    emitter.on(pwaEvent.offlineReady, () => {
      setIsOfflineReady(true);
    });

    return () => {
      // Note: mitt doesn't return unsubscribe functions, so we'll handle cleanup differently
      // For now, we'll rely on component unmounting to naturally clean up
    };
  }, []);

  const handleUpdateClick = async () => {
    if (!updateSW) return;

    try {
      setIsUpdating(true);
      await updateSW();
    } catch (error) {
      console.error("Update failed:", error);
      setIsUpdating(false);
      toast.error("Update Failed", {
        description: "Failed to update the app. Please try again.",
      });
    }
  };

  const handleCloseClick = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  const handlePostponeClick = () => {
    const pwaService = PWAService.getInstance();
    pwaService.rejectUpdate();
    setIsVisible(false);
  };

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed ${positionClasses[position]} z-50 max-w-sm`}>
      <Card className="shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DownloadIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium">
                App Update Available
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              onClick={handleCloseClick}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-xs">
            A new version of LiteChat is ready to install.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs">
                {isOfflineReady ? "Offline Ready" : "Online"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                PWA Update
              </Badge>
            </div>

            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={handleUpdateClick}
                disabled={isUpdating}
                className="flex-1"
              >
                {isUpdating ? (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <DownloadIcon className="h-3 w-3 mr-1" />
                    Update Now
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePostponeClick}
                disabled={isUpdating}
              >
                Later
              </Button>
            </div>

            {isOfflineReady && (
              <p className="text-xs text-muted-foreground">
                Your app works offline and will update when convenient.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAUpdateNotification;
