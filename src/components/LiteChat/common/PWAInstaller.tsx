import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstaller: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is already installed
  const checkInstalled = useCallback(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return true;
    }
    
    // Check for iOS standalone mode
    if ((window.navigator as any).standalone) {
      setIsInstalled(true);
      return true;
    }
    
    return false;
  }, []);

  // Memoized event handlers to prevent unnecessary re-registration
  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();
    const promptEvent = e as BeforeInstallPromptEvent;
    setDeferredPrompt(promptEvent);
    
    // Show install banner after a delay if not dismissed before and not installed
    setTimeout(() => {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed && !checkInstalled()) {
        setShowInstallBanner(true);
      }
    }, 5000); // Show after 5 seconds
  }, [checkInstalled]);

  const handleAppInstalled = useCallback(() => {
    setIsInstalled(true);
    setShowInstallBanner(false);
    setDeferredPrompt(null);
    toast.success('LiteChat installed successfully!');
  }, []);

  useEffect(() => {
    // Initial installation check
    checkInstalled();

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup function
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []); // Empty dependency array - event handlers are memoized

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('Installing LiteChat...');
      } else {
        toast.info('Installation cancelled');
      }
      
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } catch (error) {
      console.error('Error during installation:', error);
      toast.error('Installation failed');
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem('pwa-install-dismissed', 'true');
    } catch (error) {
      // Handle localStorage errors (e.g., in private browsing mode)
      console.warn('Could not save PWA install dismissal preference:', error);
    }
  };

  // Don't show anything if already installed or no prompt available
  if (isInstalled || !deferredPrompt) return null;

  return (
    <>
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
          <div className="bg-card border rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Install LiteChat</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Get the full app experience with offline support and faster loading.
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleInstallClick}
                    className="h-8 px-3 text-xs"
                  >
                    Install
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="h-8 px-3 text-xs"
                  >
                    Not now
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDismiss}
                className="h-6 w-6 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 