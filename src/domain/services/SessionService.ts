import { db, type SessionRow, type SessionExerciseRow, type SetRow } from '../../db/db'
import { ulid } from '../../utils/ulid'
import { invariant } from '../../utils/assert'
import type { EndLog, SetType } from '../models/types'
import { updatePRsForSession, recomputePRForExercise } from './PRService'
import { snapshotSessionToTmp, snapshotSessionFinalToInternal, purgeTmpBackupsKeepLastWorkoutDay } from './BackupService'
import { applySessionCompletion, applySessionEdit } from './StatsService'

export async function startSessionFromSchedule(date: string): Promise<string> {
  const schedule = await db.schedule.get({ date } as any);
  const now = Date.now();

  let session = await db.sessions.where('date').equals(date).and(s => s.scheduleId === schedule?.id).first();

  return db.transaction('rw', db.sessions, db.sessionExercises, db.dayExercises, async () => {
    if (!session) {
      const sessionId = ulid(now);
      const row: SessionRow = {
        id: sessionId,
        scheduleId: schedule?.id ?? null,
        programId: schedule?.programId ?? null,
        programVersionId: schedule?.programVersionId ?? null,
        dayTemplateId: schedule?.dayTemplateId ?? null,
        date,
        state: 'IN_PROGRESS',
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await db.sessions.put(row);
      session = row;

      // seed exercises from template if present
      if (schedule?.dayTemplateId) {
        const dayEx = await db.dayExercises.where('dayTemplateId').equals(schedule.dayTemplateId).sortBy('order');
        let order = 1;
        for (const de of dayEx) {
          const se: SessionExerciseRow = {
            id: ulid(),
            sessionId,
            exerciseId: de.exerciseId,
            order: order++,
            groupId: de.groupId,
            sourceDayExerciseId: de.id,
            createdAt: now,
            updatedAt: now,
          };
          await db.sessionExercises.put(se);
        }
      }
      return sessionId;
    }

    // If PLANNED, transition to IN_PROGRESS
    if (session.state === 'PLANNED') {
      const updated = { ...session, state: 'IN_PROGRESS' as const, startedAt: now, updatedAt: now };
      await db.sessions.put(updated);
      session = updated;
    }
    return session.id;
  });
}

export async function resumeActiveSession(): Promise<string | null> {
  const s = await db.sessions.where('state').equals('IN_PROGRESS').first();
  return s?.id ?? null;
}

export async function addOrSwapExercise(sessionId: string, payload: { mode: 'ADD'|'SWAP'; sessionExerciseId?: string; exerciseId: string }): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.sessionExercises, async () => {
    const list = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
    if (payload.mode === 'ADD') {
      const nextOrder = (list[list.length-1]?.order ?? 0) + 1;
      await db.sessionExercises.put({
        id: ulid(),
        sessionId,
        exerciseId: payload.exerciseId,
        order: nextOrder,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    invariant(payload.sessionExerciseId, 'sessionExerciseId required for swap');
    const target = await db.sessionExercises.get(payload.sessionExerciseId);
    if (!target) return;
    await db.sessionExercises.put({ ...target, exerciseId: payload.exerciseId, updatedAt: now });
  });
}

export async function logSet(sessionId: string, sessionExerciseId: string, setPayload: {
  setType: SetType;
  reps?: number;
  load?: number;
  rir?: number;
  distance?: number;
  durationSec?: number;
  calories?: number;
}): Promise<string> {
  const now = Date.now();
  const se = await db.sessionExercises.get(sessionExerciseId);
  invariant(se && se.sessionId === sessionId, 'Invalid sessionExercise');

  const order = (await db.sets.where('sessionExerciseId').equals(sessionExerciseId).count()) + 1;

  const row: SetRow = {
    id: ulid(),
    sessionId,
    sessionExerciseId,
    exerciseId: se.exerciseId,
    setType: setPayload.setType,
    order,
    reps: setPayload.reps,
    load: setPayload.load,
    rir: setPayload.rir,
    distance: setPayload.distance,
    durationSec: setPayload.durationSec,
    calories: setPayload.calories,
    createdAt: now,
  };

  await db.transaction('rw', db.sets, db.sessions, async () => {
    await db.sets.put(row);
    const sess = await db.sessions.get(sessionId);
    if (sess && sess.state === 'PLANNED') {
      await db.sessions.put({ ...sess, state: 'IN_PROGRESS', startedAt: sess.startedAt ?? now, updatedAt: now });
    }
  });

  // tmp backup after each set (best-effort)
  try { await snapshotSessionToTmp(sessionId); } catch {}

  return row.id;
}

export async function finishSession(sessionId: string, endLog: EndLog): Promise<void> {
  const now = Date.now();
  const session = await db.sessions.get(sessionId);
  invariant(session, 'Session not found');

  const setsCount = await db.sets.where('sessionId').equals(sessionId).count();
  invariant(setsCount >= 1, 'Session requires at least 1 set');

  await db.transaction('rw', db.sessions, db.schedule, db.sessionStats, db.prs, db.stats, async () => {
    const startedAt = session.startedAt ?? now;
    const durationSec = Math.max(0, Math.floor((now - startedAt) / 1000));
    const completed: SessionRow = {
      ...session,
      finishedAt: now,
      durationSec,
      endLog,
      state: 'COMPLETED',
      updatedAt: now,
    };
    await db.sessions.put(completed);

    // PR + stats
    await updatePRsForSession(sessionId);
    await applySessionCompletion(sessionId);

    // final snapshot to internal storage (best-effort)
    try { await snapshotSessionFinalToInternal(sessionId); } catch {}

    // archive
    await db.sessions.put({ ...completed, state: 'ARCHIVED', updatedAt: Date.now() });

    // mark schedule completed
    if (session.scheduleId) {
      const sch = await db.schedule.get(session.scheduleId);
      if (sch) {
        await db.schedule.put({ ...sch, state: 'COMPLETED', linkedSessionId: sessionId, updatedAt: Date.now() });
      }
    }
  });
}

export async function enterEditMode(sessionId: string): Promise<void> {
  // UI-only; we rely on sessionStats as baseline for deterministic adjustment.
  const sess = await db.sessions.get(sessionId);
  invariant(sess && (sess.state === 'COMPLETED' || sess.state === 'ARCHIVED'), 'Edit mode only for completed sessions');
}

export async function saveEditedSession(sessionId: string): Promise<void> {
  // Recompute PRs and stats deltas based on sessionStats stored row.
  const now = Date.now();
  const sess = await db.sessions.get(sessionId);
  invariant(sess, 'Session not found');

  await db.transaction('rw', db.sessions, db.sessionStats, db.stats, db.prs, async () => {
    await applySessionEdit(sessionId);

    // Recompute PRs for all exercises involved (simpler deterministic strategy)
    const exerciseIds = await db.sets.where('sessionId').equals(sessionId).toArray().then(a => Array.from(new Set(a.map(s=>s.exerciseId))));
    for (const exId of exerciseIds) {
      await recomputePRForExercise(exId);
    }

    await db.sessions.put({ ...sess, updatedAt: now }); // keep ARCHIVED
  });
}

export async function updateSet(setId: string, patch: Partial<Pick<SetRow,'reps'|'load'|'rir'|'setType'|'distance'|'durationSec'|'calories'>>): Promise<void> {
  const row = await db.sets.get(setId);
  if (!row) return;
  await db.sets.put({ ...row, ...patch });
}

export async function deleteSet(setId: string): Promise<void> {
  await db.sets.delete(setId);
}
