export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaHandlers {
  onInstallAvailable: (available: boolean) => void;
  onUpdateAvailable: (registration: ServiceWorkerRegistration) => void;
}

class PwaService {
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private swReloadTriggered = false;
  private swRegistered = false;
  private waitingRegistration: ServiceWorkerRegistration | null = null;
  private initialized = false;

  public init(handlers: PwaHandlers): () => void {
    if (typeof window === 'undefined') return () => {};
    if (this.initialized) return () => {};
    this.initialized = true;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      this.deferredInstallPrompt = e as BeforeInstallPromptEvent;
      handlers.onInstallAvailable(true);
    };

    const handleAppInstalled = () => {
      this.deferredInstallPrompt = null;
      handlers.onInstallAvailable(false);
    };

    const handleControllerChange = () => {
      if (this.swReloadTriggered) return;
      this.swReloadTriggered = true;
      window.location.reload();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    try {
      if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
        if (!this.swRegistered) {
          this.swRegistered = true;
          navigator.serviceWorker
            .register('service-worker.js')
            .then((reg) => {
              reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener('statechange', () => {
                  if (
                    newWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                  ) {
                    this.waitingRegistration = reg;
                    handlers.onUpdateAvailable(reg);
                  }
                });
              });
            })
            .catch(() => {
              // Graceful fallback — offline support is optional
            });
        }

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          handleControllerChange,
        );
      }
    } catch (err) {
      console.warn('[PWA] Service worker registration error:', err);
    }

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          handleControllerChange,
        );
      }
      this.initialized = false;
    };
  }

  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredInstallPrompt) return 'unavailable';
    this.deferredInstallPrompt.prompt();
    let outcome: 'accepted' | 'dismissed' = 'dismissed';
    try {
      const choice = await this.deferredInstallPrompt.userChoice;
      outcome = choice.outcome;
    } catch {
      // Ignore forced prompt cancellation errors
    }
    this.deferredInstallPrompt = null;
    return outcome;
  }

  public applyUpdate(reg?: ServiceWorkerRegistration | null): void {
    const targetReg = reg ?? this.waitingRegistration;
    if (targetReg && targetReg.waiting) {
      targetReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}

export const pwaService = new PwaService();
