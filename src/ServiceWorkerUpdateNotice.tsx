import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdateNotice } from './design/UpdateNotice';

export function ServiceWorkerUpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker: updateSW,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <UpdateNotice
      onDismiss={() => setNeedRefresh(false)}
      onReload={() => void updateSW(true)}
    />
  );
}
