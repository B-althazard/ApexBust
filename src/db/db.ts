import Dexie, { type Table } from 'dexie'
import type { ULID, ExerciseType, Unit, ScheduleType, ScheduleState, SessionState, SetType, ThemeMode, Prescription, EndLog } from '../domain/models/types'

export type ExerciseRow = {
  id: ULID;
  name: string;
  type: ExerciseType;
  defaultUnit: Unit;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ProgramRow = {
  id: ULID;
  name: string;
  createdAt: number;
  updatedAt: number;
  activeProgramVersionId: ULID;
};

export type ProgramVersionRow = {
  id: ULID;
  programId: ULID;
  versionNumber: number;
  notes?: string;
  createdAt: number;
};

export type WeekTemplateRow = {
  id: ULID;
  programVersionId: ULID;
  name?: string;
  createdAt: number;
};

export type DayTemplateRow = {
  id: ULID;
  weekTemplateId: ULID;
  weekday: number; // 0..6 (internal: 0=Sunday)
  title: string;
  createdAt: number;
};

export type DayExerciseRow = {
  id: ULID;
  dayTemplateId: ULID;
  exerciseId: ULID;
  order: number;
  groupId?: string;
  isWarmupDefault: boolean;
  prescription?: Prescription;
  createdAt: number;
};

export type ScheduleRow = {
  id: ULID;
  date: string; // YYYY-MM-DD
  type: ScheduleType;
  programId?: ULID | null;
  programVersionId?: ULID | null;
  dayTemplateId?: ULID | null;
  title?: string;
  state: ScheduleState;
  linkedSessionId?: ULID | null;
  createdAt: number;
  updatedAt: number;
};

export type SessionRow = {
  id: ULID;
  scheduleId?: ULID | null;
  programId?: ULID | null;
  programVersionId?: ULID | null;
  dayTemplateId?: ULID | null;
  date: string;
  state: SessionState;
  startedAt?: number;
  finishedAt?: number;
  durationSec?: number;
  notes?: string;
  endLog?: EndLog;
  createdAt: number;
  updatedAt: number;
};

export type SessionExerciseRow = {
  id: ULID;
  sessionId: ULID;
  exerciseId: ULID;
  order: number;
  groupId?: string;
  sourceDayExerciseId?: ULID | null;
  createdAt: number;
  updatedAt: number;
};

export type SetRow = {
  id: ULID;
  sessionId: ULID;
  sessionExerciseId: ULID;
  exerciseId: ULID;
  setType: SetType;
  order: number;
  reps?: number;
  load?: number;
  rir?: number;
  distance?: number;
  durationSec?: number;
  calories?: number;
  createdAt: number;
};

export type PRRow = {
  id: ULID;
  exerciseId: ULID;
  metric: 'MAX_LOAD';
  value: number;
  sessionId: ULID;
  setId: ULID;
  achievedAt: number;
  updatedAt: number;
};

export type BodyweightRow = {
  id: ULID;
  date: string;
  weight: number;
  unit: 'KG'|'LB';
  createdAt: number;
  updatedAt: number;
};

export type StatsRow = {
  id: 'GLOBAL';
  totalSessionsCompleted: number;
  totalSetsLogged: number;
  totalVolumeLoad: number;
  totalWorkoutDurationSec: number;
  lastUpdatedAt: number;
};

export type SessionStatsRow = {
  sessionId: ULID; // PK
  setsCount: number;
  volumeLoad: number;
  durationSec: number;
  updatedAt: number;
};

export type SettingsRow = {
  id: 'USER';
  themeMode: ThemeMode;
  anchorWeekday: number; // 0..6
  defaultRestWeekdays: number[];
  units: { weightUnit: 'KG'|'LB' };
  backupReminder: { enabled: boolean; remindAfterDays: number; lastExportAt?: number };
  createdAt: number;
  updatedAt: number;
};

export type ExportRow = {
  id: ULID;
  type: 'MARKDOWN_FULL_HISTORY';
  createdAt: number;
};

export class AppDB extends Dexie {
  exercises!: Table<ExerciseRow, string>;
  programs!: Table<ProgramRow, string>;
  programVersions!: Table<ProgramVersionRow, string>;
  weekTemplates!: Table<WeekTemplateRow, string>;
  dayTemplates!: Table<DayTemplateRow, string>;
  dayExercises!: Table<DayExerciseRow, string>;
  schedule!: Table<ScheduleRow, string>;
  sessions!: Table<SessionRow, string>;
  sessionExercises!: Table<SessionExerciseRow, string>;
  sets!: Table<SetRow, string>;
  prs!: Table<PRRow, string>;
  bodyweights!: Table<BodyweightRow, string>;
  stats!: Table<StatsRow, 'GLOBAL'>;
  sessionStats!: Table<SessionStatsRow, string>;
  settings!: Table<SettingsRow, 'USER'>;
  exports!: Table<ExportRow, string>;

  constructor() {
    super('webapp_workout_tracker');

    // v1 schema
    this.version(1).stores({
      exercises: 'id, name, archived',
      programs: 'id, activeProgramVersionId',
      programVersions: 'id, programId, [programId+versionNumber]',
      weekTemplates: 'id, programVersionId',
      dayTemplates: 'id, weekTemplateId, [weekTemplateId+weekday]',
      dayExercises: 'id, dayTemplateId, [dayTemplateId+order], exerciseId, groupId',
      // Unique schedule per date enforced (v1 decision)
      schedule: 'id,&date,[programId+date],state,type,dayTemplateId',
      sessions: 'id,date,[programId+date],state,dayTemplateId,scheduleId',
      sessionExercises: 'id,sessionId,[sessionId+order],exerciseId',
      sets: 'id,sessionId,sessionExerciseId,[exerciseId+createdAt]',
      prs: 'id,&exerciseId,metric',
      bodyweights: 'id,&date',
      stats: 'id',
      sessionStats: 'sessionId',
      settings: 'id',
      exports: 'id,createdAt,type',
    });
  }
}

export const db = new AppDB();
