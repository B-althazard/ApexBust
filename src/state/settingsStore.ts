import { create } from 'zustand'
import { db, type SettingsRow } from '../db/db'

type SettingsState = {
  settings: SettingsRow | null;
  load: () => Promise<void>;
  setThemeMode: (mode: SettingsRow['themeMode']) => Promise<void>;
  setAnchorWeekday: (wd: number) => Promise<void>;
  setDefaultRestWeekdays: (wds: number[]) => Promise<void>;
  setWeightUnit: (unit: 'KG'|'LB') => Promise<void>;
  setBackupReminder: (patch: Partial<SettingsRow['backupReminder']>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  load: async () => {
    const s = await db.settings.get('USER');
    set({ settings: s ?? null });
    applyTheme(s?.themeMode ?? 'SYSTEM');
  },
  setThemeMode: async (mode) => {
    const s = get().settings;
    if (!s) return;
    const updated = { ...s, themeMode: mode, updatedAt: Date.now() };
    await db.settings.put(updated);
    set({ settings: updated });
    applyTheme(mode);
  },
  setAnchorWeekday: async (wd) => {
    const s = get().settings;
    if (!s) return;
    const updated = { ...s, anchorWeekday: wd, updatedAt: Date.now() };
    await db.settings.put(updated);
    set({ settings: updated });
  },
  setDefaultRestWeekdays: async (wds) => {
    const s = get().settings;
    if (!s) return;
    const updated = { ...s, defaultRestWeekdays: Array.from(new Set(wds)).sort((a,b)=>a-b), updatedAt: Date.now() };
    await db.settings.put(updated);
    set({ settings: updated });
  },
  setWeightUnit: async (unit) => {
    const s = get().settings;
    if (!s) return;
    const updated = { ...s, units: { ...s.units, weightUnit: unit }, updatedAt: Date.now() };
    await db.settings.put(updated);
    set({ settings: updated });
  },
  setBackupReminder: async (patch) => {
    const s = get().settings;
    if (!s) return;
    const updated = { ...s, backupReminder: { ...s.backupReminder, ...patch }, updatedAt: Date.now() };
    await db.settings.put(updated);
    set({ settings: updated });
  },
}));

function applyTheme(mode: SettingsRow['themeMode']) {
  const root = document.documentElement;
  if (mode === 'SYSTEM') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', mode === 'LIGHT' ? 'light' : 'dark');
}
