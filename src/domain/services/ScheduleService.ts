import { db, type ScheduleRow } from '../../db/db'
import { ulid } from '../../utils/ulid'
import { addDays, startOfAnchoredWeek, type YMD } from '../../utils/date'
import { getActiveProgram } from './ProgramService'

export async function generateWeekSchedule(anchorDate: YMD): Promise<void> {
  const settings = await db.settings.get('USER');
  if (!settings) return;
  const weekStart = startOfAnchoredWeek(anchorDate, settings.anchorWeekday);
  const active = await getActiveProgram();
  const now = Date.now();

  const dayTemplateByWeekday = new Map<number, { dayTemplateId: string; title: string; programId: string; programVersionId: string }>();
  if (active) {
    for (const dt of active.dayTemplates) {
      dayTemplateByWeekday.set(dt.weekday, {
        dayTemplateId: dt.id,
        title: dt.title,
        programId: active.program.id,
        programVersionId: active.programVersion.id,
      });
    }
  }

  const dates: YMD[] = [];
  for (let i=0;i<7;i++) dates.push(addDays(weekStart, i));

  await db.transaction('rw', db.schedule, async () => {
    for (let i=0;i<7;i++) {
      const date = dates[i]!;
      const weekday = (settings.anchorWeekday + i) % 7;

      const existing = await db.schedule.get({ date } as any);
      if (existing) continue; // do not override user changes or already-generated entries

      const tpl = dayTemplateByWeekday.get(weekday);
      let row: ScheduleRow;
      if (tpl) {
        row = {
          id: ulid(),
          date,
          type: 'WORKOUT',
          programId: tpl.programId,
          programVersionId: tpl.programVersionId,
          dayTemplateId: tpl.dayTemplateId,
          title: tpl.title,
          state: 'PLANNED',
          linkedSessionId: null,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        const isRest = settings.defaultRestWeekdays.includes(weekday);
        row = {
          id: ulid(),
          date,
          type: isRest ? 'REST' : 'REST',
          programId: null,
          programVersionId: null,
          dayTemplateId: null,
          title: isRest ? 'Rest' : 'Rest',
          state: 'PLANNED',
          linkedSessionId: null,
          createdAt: now,
          updatedAt: now,
        };
      }
      await db.schedule.put(row);
    }
  });
}

export async function getScheduleForMonth(year: number, month1to12: number): Promise<ScheduleRow[]> {
  const monthIdx = month1to12 - 1;
  const start = new Date(year, monthIdx, 1);
  const end = new Date(year, monthIdx + 1, 0);
  const startY = `${year}-${String(month1to12).padStart(2,'0')}-01`;
  const endY = `${year}-${String(month1to12).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
  return db.schedule.where('date').between(startY, endY, true, true).toArray();
}

export async function markSkipped(date: YMD): Promise<void> {
  const row = await db.schedule.get({ date } as any);
  if (!row) return;
  await db.schedule.put({ ...row, state: 'SKIPPED', updatedAt: Date.now() });
}

export async function performNowAndShift(fromDate: YMD, toDate: YMD): Promise<void> {
  // Move the planned workout on fromDate to toDate; shift subsequent schedule items by +1 day.
  const from = await db.schedule.get({ date: fromDate } as any);
  if (!from || from.type !== 'WORKOUT' || from.state !== 'PLANNED') return;

  await db.transaction('rw', db.schedule, async () => {
    const all = await db.schedule.orderBy('date').toArray();
    const idx = all.findIndex(e => e.date === fromDate);
    if (idx < 0) return;

    // Remove/mark fromDate as skipped (historical)
    await db.schedule.put({ ...from, state: 'SKIPPED', updatedAt: Date.now() });

    // Build list of entries after fromDate (strictly greater)
    const tail = all.filter(e => e.date > fromDate);
    // We will shift those entries +1 day starting from toDate onward, including any entry already on toDate.
    // Strategy:
    // - Ensure unique date: iterate tail in descending order and move each to +1 day.
    const toMove = tail.slice().sort((a,b)=> b.date.localeCompare(a.date));
    for (const e of toMove) {
      const newDate = addDays(e.date, 1);
      // delete old and put new
      await db.schedule.delete(e.id);
      await db.schedule.put({ ...e, date: newDate, updatedAt: Date.now() });
    }

    // Now place the from workout onto toDate (create or overwrite existing by deleting its row first if any)
    const existingToday = await db.schedule.get({ date: toDate } as any);
    if (existingToday) await db.schedule.delete(existingToday.id);
    await db.schedule.put({ ...from, id: ulid(), date: toDate, state: 'PLANNED', linkedSessionId: null, updatedAt: Date.now(), createdAt: Date.now() });
  });
}

export async function insertRestDay(date: YMD): Promise<{ swapped: boolean }> {
  const settings = await db.settings.get('USER');
  if (!settings) return { swapped: false };

  const row = await db.schedule.get({ date } as any);
  if (!row || row.type !== 'WORKOUT' || row.state !== 'PLANNED') return { swapped: false };

  const weekStart = startOfAnchoredWeek(date, settings.anchorWeekday);
  const weekEnd = addDays(weekStart, 6);

  // Find next default rest day within same week window
  const candidates = await db.schedule.where('date').between(weekStart, weekEnd, true, true).toArray();
  const restCandidate = candidates.find(e => e.type === 'REST' && settings.defaultRestWeekdays.includes(new Date(e.date+'T00:00:00').getDay()));
  if (!restCandidate) {
    // fallback: behave as NO
    await db.schedule.put({ ...row, type: 'REST', title: 'Rest', updatedAt: Date.now() });
    return { swapped: false };
  }

  // Swap: date X becomes REST, restCandidate becomes WORKOUT with template
  await db.transaction('rw', db.schedule, async () => {
    await db.schedule.put({ ...row, type: 'REST', title: 'Rest', updatedAt: Date.now() });
    await db.schedule.put({
      ...restCandidate,
      type: 'WORKOUT',
      programId: row.programId,
      programVersionId: row.programVersionId,
      dayTemplateId: row.dayTemplateId,
      title: row.title,
      state: 'PLANNED',
      linkedSessionId: null,
      updatedAt: Date.now(),
    });
  });

  return { swapped: true };
}

export async function convertWorkoutToRest(date: YMD): Promise<void> {
  const row = await db.schedule.get({ date } as any);
  if (!row || row.type !== 'WORKOUT' || row.state !== 'PLANNED') return;

  await db.transaction('rw', db.schedule, db.sessions, db.sessionExercises, db.sets, async () => {
    // If a PLANNED session exists with no sets, delete it.
    const session = await db.sessions.where('scheduleId').equals(row.id).first();
    if (session && session.state === 'PLANNED') {
      const setCount = await db.sets.where('sessionId').equals(session.id).count();
      if (setCount === 0) {
        await db.sessionExercises.where('sessionId').equals(session.id).delete();
        await db.sessions.delete(session.id);
      }
    }

    await db.schedule.put({ ...row, type: 'REST', title: 'Rest', updatedAt: Date.now() });
  });
}
