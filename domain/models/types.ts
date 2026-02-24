export type ULID = string;
export type YMD = string;

export type ExerciseType = 'STRENGTH'|'CARDIO'|'OTHER';
export type Unit = 'KG'|'LB'|'MIN'|'M'|'KM'|'CAL'|'NONE';
export type ScheduleType = 'WORKOUT'|'REST';
export type ScheduleState = 'PLANNED'|'COMPLETED'|'SKIPPED';
export type SessionState = 'PLANNED'|'IN_PROGRESS'|'COMPLETED'|'ARCHIVED';
export type SetType = 'WARMUP'|'WORKING'|'CARDIO'|'OTHER';
export type ThemeMode = 'SYSTEM'|'LIGHT'|'DARK'|'AMOLED';

export type Prescription = {
  targetSets?: number;
  targetReps?: string;
  targetRIR?: number;
  restSec?: number;
  notes?: string;
};

export type EndLog = {
  performance: number; // 1-5
  energy: number; // 1-5
  mindMuscle: number; // 1-5
  mentalState?: string;
  preWorkoutUsed?: string;
};

export type UnitsSettings = { weightUnit: 'KG'|'LB' };

export type BackupReminder = {
  enabled: boolean;
  remindAfterDays: number;
  lastExportAt?: number;
};
