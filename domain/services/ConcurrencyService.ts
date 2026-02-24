import { useUIStore } from '../../app/uiStore'

const CHANNEL = 'watt_instance_lock';
const KEY = 'watt_active_instance';
const HEARTBEAT_MS = 2000;
const STALE_MS = 6000;

type LockMsg =
  | { type: 'HELLO'; instanceId: string }
  | { type: 'I_AM_ACTIVE'; instanceId: string };

const instanceId = crypto.randomUUID();
let bc: BroadcastChannel | null = null;
let hb: number | null = null;
let locked = false;

function now() { return Date.now(); }

function readActive(): { instanceId: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { instanceId: string; ts: number };
    if (!parsed.instanceId || !parsed.ts) return null;
    return parsed;
  } catch { return null; }
}

function writeActive() {
  localStorage.setItem(KEY, JSON.stringify({ instanceId, ts: now() }));
}

function isStale(active: { ts: number }) {
  return now() - active.ts > STALE_MS;
}

export async function acquireInstanceLockOrThrow(): Promise<void> {
  bc = new BroadcastChannel(CHANNEL);

  bc.onmessage = (ev) => {
    const msg = ev.data as LockMsg;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'HELLO') {
      // If we are active, respond
      if (!locked) {
        bc?.postMessage({ type: 'I_AM_ACTIVE', instanceId } satisfies LockMsg);
      }
    }
    if (msg.type === 'I_AM_ACTIVE') {
      if (msg.instanceId !== instanceId) {
        // Another tab says it's active -> lock ourselves
        locked = true;
        useUIStore.getState().setLock(true);
      }
    }
  };

  // First, check localStorage heartbeat
  const active = readActive();
  if (active && active.instanceId !== instanceId && !isStale(active)) {
    locked = true;
    useUIStore.getState().setLock(true);
    return;
  }

  // Probe other tabs quickly
  bc.postMessage({ type: 'HELLO', instanceId } satisfies LockMsg);
  await new Promise((r) => setTimeout(r, 120));

  if (useUIStore.getState().lock) return;

  // Acquire
  writeActive();
  hb = window.setInterval(() => {
    if (locked) return;
    writeActive();
  }, HEARTBEAT_MS);
}

export function releaseInstanceLock(): void {
  if (hb) window.clearInterval(hb);
  hb = null;
  bc?.close();
  bc = null;
  try {
    const active = readActive();
    if (active?.instanceId === instanceId) localStorage.removeItem(KEY);
  } catch {}
}

window.addEventListener('beforeunload', () => releaseInstanceLock());
