import { registerSW } from 'virtual:pwa-register'

export function initPWAUpdates(onNeedRefresh: () => void) {
  registerSW({
    immediate: true,
    onNeedRefresh,
    onOfflineReady() {},
  });
}
