import { useUIStore } from '../app/uiStore'

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const swUrl = new URL('../sw.js', import.meta.url);
  navigator.serviceWorker.register(swUrl, { scope: './' }).then((reg) => {
    // Update flow: when a new SW is installed, prompt user to refresh.
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          useUIStore.getState().setUpdateAvailable(true);
        }
      });
    });
  }).catch(() => {
    // ignore registration errors (offline/unsupported)
  });
}

export async function hardReloadToUpdate(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return window.location.reload();
  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  window.location.reload();
}
