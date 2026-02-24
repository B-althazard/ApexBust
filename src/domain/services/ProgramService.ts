import { db, type DayExerciseRow, type DayTemplateRow, type ExerciseRow, type ProgramRow, type ProgramVersionRow, type WeekTemplateRow } from '../../db/db'
import { ulid } from '../../utils/ulid'
import { invariant } from '../../utils/assert'

export type ProgramImportV1 = {
  schemaVersion: 1;
  program: {
    name: string;
    anchorWeekday?: number;
    weekTemplate: {
      name?: string;
      days: Array<{
        weekday: number; // 0..6
        title: string;
        exercises: Array<{
          name?: string;
          exerciseId?: string;
          order: number;
          groupId?: string;
          prescription?: any;
          isWarmupDefault?: boolean;
        }>;
      }>;
    };
  };
  exercises?: Array<{
    id?: string;
    name: string;
    type?: 'STRENGTH'|'CARDIO'|'OTHER';
    defaultUnit?: 'KG'|'LB'|'MIN'|'M'|'KM'|'CAL'|'NONE';
  }>;
};

function normalizeExerciseType(t?: string): 'STRENGTH'|'CARDIO'|'OTHER' {
  if (t === 'CARDIO' || t === 'OTHER') return t;
  return 'STRENGTH';
}
function normalizeUnit(u?: string): any {
  const allowed = new Set(['KG','LB','MIN','M','KM','CAL','NONE']);
  return (u && allowed.has(u)) ? u : 'KG';
}

export async function importProgram(json: ProgramImportV1): Promise<{ programId: string; programVersionId: string; importedAnchorWeekday?: number; }> {
  validateImport(json);
  const now = Date.now();

  const programId = ulid(now);
  const programVersionId = ulid(now + 1);
  const weekTemplateId = ulid(now + 2);

  const program: ProgramRow = {
    id: programId,
    name: json.program.name,
    createdAt: now,
    updatedAt: now,
    activeProgramVersionId: programVersionId,
  };

  const pv: ProgramVersionRow = {
    id: programVersionId,
    programId,
    versionNumber: 1,
    createdAt: now,
    notes: undefined,
  };

  const wt: WeekTemplateRow = {
    id: weekTemplateId,
    programVersionId,
    name: json.program.weekTemplate.name,
    createdAt: now,
  };

  await db.transaction('rw', db.exercises, db.programs, db.programVersions, db.weekTemplates, db.dayTemplates, db.dayExercises, async () => {
    // Exercises: ensure registry exists for each referenced
    const exerciseIdByName = new Map<string,string>();

    const embedded = json.exercises ?? [];
    for (const e of embedded) {
      const id = (e.id && typeof e.id === 'string') ? e.id : ulid();
      const row: ExerciseRow = {
        id,
        name: e.name,
        type: normalizeExerciseType(e.type),
        defaultUnit: normalizeUnit(e.defaultUnit),
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      // upsert by id
      const existing = await db.exercises.get(id);
      if (!existing) await db.exercises.put(row);
      exerciseIdByName.set(e.name.toLowerCase(), id);
    }

    // Also create missing exercises referenced by name
    for (const day of json.program.weekTemplate.days) {
      for (const ex of day.exercises) {
        if (ex.exerciseId) continue;
        invariant(ex.name, 'exercise must have name or exerciseId');
        const key = ex.name!.toLowerCase();
        if (exerciseIdByName.has(key)) continue;
        const id = ulid();
        const row: ExerciseRow = {
          id,
          name: ex.name!,
          type: 'STRENGTH',
          defaultUnit: 'KG',
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.exercises.put(row);
        exerciseIdByName.set(key, id);
      }
    }

    await db.programs.put(program);
    await db.programVersions.put(pv);
    await db.weekTemplates.put(wt);

    for (const day of json.program.weekTemplate.days) {
      const dayTemplateId = ulid();
      const dt: DayTemplateRow = {
        id: dayTemplateId,
        weekTemplateId,
        weekday: day.weekday,
        title: day.title,
        createdAt: now,
      };
      await db.dayTemplates.put(dt);

      const sorted = [...day.exercises].sort((a,b)=>a.order-b.order);
      for (const e of sorted) {
        const exerciseId = e.exerciseId ?? exerciseIdByName.get((e.name ?? '').toLowerCase());
        invariant(exerciseId, `unknown exercise for ${e.name ?? e.exerciseId}`);
        const de: DayExerciseRow = {
          id: ulid(),
          dayTemplateId,
          exerciseId,
          order: e.order,
          groupId: e.groupId,
          isWarmupDefault: !!e.isWarmupDefault,
          prescription: e.prescription,
          createdAt: now,
        };
        await db.dayExercises.put(de);
      }
    }
  });

  return { programId, programVersionId, importedAnchorWeekday: json.program.anchorWeekday };
}

export async function getActiveProgram(): Promise<{
  program: ProgramRow;
  programVersion: ProgramVersionRow;
  weekTemplate: WeekTemplateRow;
  dayTemplates: DayTemplateRow[];
  dayExercises: DayExerciseRow[];
} | null> {
  const programs = await db.programs.toArray();
  if (programs.length === 0) return null;
  const program = programs[0]!;
  const pv = await db.programVersions.get(program.activeProgramVersionId);
  if (!pv) return null;
  const wt = await db.weekTemplates.where('programVersionId').equals(pv.id).first();
  if (!wt) return null;
  const dayTemplates = await db.dayTemplates.where('weekTemplateId').equals(wt.id).toArray();
  const dayTemplateIds = dayTemplates.map(d=>d.id);
  const dayExercises = await db.dayExercises.where('dayTemplateId').anyOf(dayTemplateIds).toArray();
  return { program, programVersion: pv, weekTemplate: wt, dayTemplates, dayExercises };
}

export async function listPrograms(): Promise<Array<{ id: string; name: string; createdAt: number }>> {
  const p = await db.programs.toArray();
  return p.map(x=>({ id:x.id, name:x.name, createdAt:x.createdAt }));
}

function validateImport(json: any): asserts json is ProgramImportV1 {
  invariant(json && typeof json === 'object', 'Invalid JSON');
  invariant(json.schemaVersion === 1, 'Unsupported schemaVersion');
  invariant(json.program && typeof json.program.name === 'string' && json.program.name.trim().length>0, 'Program name required');
  const days = json.program?.weekTemplate?.days;
  invariant(Array.isArray(days) && days.length>0, 'weekTemplate.days required');
  const weekdaySet = new Set<number>();
  for (const d of days) {
    invariant(typeof d.weekday === 'number' && d.weekday>=0 && d.weekday<=6, 'Invalid weekday');
    invariant(typeof d.title === 'string' && d.title.trim().length>0, 'Day title required');
    invariant(!weekdaySet.has(d.weekday), 'Duplicate weekday in weekTemplate');
    weekdaySet.add(d.weekday);
    invariant(Array.isArray(d.exercises), 'day.exercises required');
    const orderSet = new Set<number>();
    for (const e of d.exercises) {
      invariant(typeof e.order === 'number', 'exercise.order required');
      if (orderSet.has(e.order)) {
        // allowed to normalize by sorting, but duplicates likely error
      }
      orderSet.add(e.order);
      invariant(!!e.name || !!e.exerciseId, 'exercise requires name or exerciseId');
    }
  }
}
