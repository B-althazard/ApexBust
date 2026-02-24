import { create } from 'zustand'

type SessionUIState = {
  activeSessionId: string | null;
  activeSessionExerciseId: string | null;
  isEditMode: boolean;
  rest: {
    enabled: boolean;
    autoStart: boolean;
    durationSec: number;
    startedAt?: number;
  };
  setActiveSession: (id: string | null) => void;
  setActiveSessionExercise: (id: string | null) => void;
  setEditMode: (v: boolean) => void;
  setRestEnabled: (v: boolean) => void;
  setAutoStart: (v: boolean) => void;
  setRestDuration: (sec: number) => void;
  startRest: (startedAt?: number) => void;
  clearRest: () => void;
};

export const useSessionStore = create<SessionUIState>((set, get) => ({
  activeSessionId: null,
  activeSessionExerciseId: null,
  isEditMode: false,
  rest: { enabled: true, autoStart: true, durationSec: 120 },
  setActiveSession: (id) => set({ activeSessionId: id }),
  setActiveSessionExercise: (id) => set({ activeSessionExerciseId: id }),
  setEditMode: (v) => set({ isEditMode: v }),
  setRestEnabled: (v) => set({ rest: { ...get().rest, enabled: v } }),
  setAutoStart: (v) => set({ rest: { ...get().rest, autoStart: v } }),
  setRestDuration: (sec) => set({ rest: { ...get().rest, durationSec: Math.max(0, Math.floor(sec)) } }),
  startRest: (startedAt) => set({ rest: { ...get().rest, startedAt: startedAt ?? Date.now() } }),
  clearRest: () => set({ rest: { ...get().rest, startedAt: undefined } }),
}));
