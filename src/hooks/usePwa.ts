import { useCallback, useEffect, useState } from 'react';
import { pwaService } from '../services/pwaService';

export function usePwa(showToast: (msg: string) => void) {
  const [canInstall, setCanInstall] = useState(false);
  const [updateRegistration, setUpdateRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    return pwaService.init({
      onInstallAvailable: (available) => {
        setCanInstall(available);
      },
      onUpdateAvailable: (reg) => {
        setUpdateRegistration(reg);
      },
    });
  }, []);

  const installApp = useCallback(async () => {
    const outcome = await pwaService.promptInstall();
    if (outcome === 'accepted') {
      showToast('📲 Reader berhasil dipasang ke Home Screen');
    }
    setCanInstall(false);
  }, [showToast]);

  const applyUpdate = useCallback(() => {
    pwaService.applyUpdate(updateRegistration);
    setUpdateRegistration(null);
  }, [updateRegistration]);

  return {
    canInstall,
    installApp,
    hasUpdate: updateRegistration !== null,
    applyUpdate,
  };
}
