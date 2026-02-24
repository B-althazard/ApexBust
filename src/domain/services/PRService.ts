import { db, type PRRow } from '../../db/db'
import { ulid } from '../../utils/ulid'

export async function updatePRsForSession(sessionId: string): Promise<void> {
  const now = Date.now();
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const byExercise = new Map<string, { maxLoad: number; setId: string; achievedAt: number }>();

  for (const s of sets) {
    if (s.setType !== 'WORKING') continue; // decision: working only
    if (typeof s.load !== 'number') continue;
    const cur = byExercise.get(s.exerciseId);
    if (!cur || s.load > cur.maxLoad) {
      byExercise.set(s.exerciseId, { maxLoad: s.load, setId: s.id, achievedAt: s.createdAt });
    }
  }

  for (const [exerciseId, best] of byExercise.entries()) {
    const existing = await db.prs.get({ exerciseId } as any);
    if (!existing) {
      const row: PRRow = {
        id: ulid(),
        exerciseId,
        metric: 'MAX_LOAD',
        value: best.maxLoad,
        sessionId,
        setId: best.setId,
        achievedAt: best.achievedAt,
        updatedAt: now,
      };
      await db.prs.put(row);
    } else if (best.maxLoad > existing.value) {
      await db.prs.put({ ...existing, value: best.maxLoad, sessionId, setId: best.setId, achievedAt: best.achievedAt, updatedAt: now });
    }
  }
}

export async function recomputePRForExercise(exerciseId: string): Promise<void> {
  // Scan sets via [exerciseId+createdAt] and compute max load across WORKING
  const sets = await db.sets.where('[exerciseId+createdAt]').between([exerciseId, 0], [exerciseId, Number.MAX_SAFE_INTEGER], true, true).toArray();
  let best: { load: number; setId: string; sessionId: string; achievedAt: number } | null = null;
  for (const s of sets) {
    if (s.setType !== 'WORKING') continue;
    if (typeof s.load !== 'number') continue;
    if (!best || s.load > best.load) best = { load: s.load, setId: s.id, sessionId: s.sessionId, achievedAt: s.createdAt };
  }
  const now = Date.now();
  const existing = await db.prs.get({ exerciseId } as any);
  if (!best) {
    if (existing) await db.prs.delete(existing.id);
    return;
  }
  if (!existing) {
    await db.prs.put({ id: ulid(), exerciseId, metric: 'MAX_LOAD', value: best.load, sessionId: best.sessionId, setId: best.setId, achievedAt: best.achievedAt, updatedAt: now });
    return;
  }
  await db.prs.put({ ...existing, value: best.load, sessionId: best.sessionId, setId: best.setId, achievedAt: best.achievedAt, updatedAt: now });
}
