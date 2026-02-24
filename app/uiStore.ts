import { create } from 'zustand'

export type SkipPromptState = {
  open: boolean;
  date: string;
};

type UIState = {
  updateAvailable: boolean;
  setUpdateAvailable: (v: boolean) => void;
  lock: boolean;
  setLock: (v: boolean) => void;
  skipPrompt: SkipPromptState | null;
  setSkipPrompt: (s: SkipPromptState | null) => void;
};

export const useUIStore = create<UIState>((set) => ({
  updateAvailable: false,
  setUpdateAvailable: (v) => set({ updateAvailable: v }),
  lock: false,
  setLock: (v) => set({ lock: v }),
  skipPrompt: null,
  setSkipPrompt: (s) => set({ skipPrompt: s }),
}));
