export class PWAService {
  private static instance: PWAService | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = PWAService.getInstance();
    await instance.registerServiceWorker();
  }

  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered successfully');
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Service Worker update available');
            }
          });
        }
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
} 