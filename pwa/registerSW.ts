import { registerSW } from 'virtual:pwa-register'
import { useUIStore } from '../app/uiStore'

let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined

export function registerServiceWorker() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      useUIStore.getState().setUpdateAvailable(true)
    },
    onOfflineReady() {},
  })
}

export async function hardReloadToUpdate() {
  try {
    useUIStore.getState().setUpdateAvailable(false)
    if (updateSW) await updateSW(true)
    window.location.reload()
  } catch {
    window.location.reload()
  }
}
