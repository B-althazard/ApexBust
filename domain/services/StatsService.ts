import { db, type SessionStatsRow } from '../../db/db'

function eligibleVolume(reps?: number, load?: number): number {
  if (typeof reps !== 'number' || typeof load !== 'number') return 0;
  return reps * load;
}

export async function applySessionCompletion(sessionId: string): Promise<void> {
  const now = Date.now();
  const sess = await db.sessions.get(sessionId);
  if (!sess) return;

  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const setsCount = sets.length;
  const volumeLoad = sets.reduce((acc,s)=> acc + eligibleVolume(s.reps, s.load), 0);
  const durationSec = sess.durationSec ?? 0;

  const stats = await db.stats.get('GLOBAL');
  if (!stats) return;

  await db.sessionStats.put({ sessionId, setsCount, volumeLoad, durationSec, updatedAt: now } satisfies SessionStatsRow);

  await db.stats.put({
    ...stats,
    totalSessionsCompleted: stats.totalSessionsCompleted + 1,
    totalSetsLogged: stats.totalSetsLogged + setsCount,
    totalVolumeLoad: stats.totalVolumeLoad + volumeLoad,
    totalWorkoutDurationSec: stats.totalWorkoutDurationSec + durationSec,
    lastUpdatedAt: now,
  });
}

export async function applySessionEdit(sessionId: string): Promise<void> {
  const now = Date.now();
  const sess = await db.sessions.get(sessionId);
  if (!sess) return;

  const old = await db.sessionStats.get(sessionId);
  const stats = await db.stats.get('GLOBAL');
  if (!stats) return;

  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const setsCount = sets.length;
  const volumeLoad = sets.reduce((acc,s)=> acc + eligibleVolume(s.reps, s.load), 0);
  const durationSec = sess.durationSec ?? 0;

  await db.sessionStats.put({ sessionId, setsCount, volumeLoad, durationSec, updatedAt: now });

  if (!old) {
    // fallback: treat as completion (shouldn't happen if completed sessions always recorded)
    await db.stats.put({
      ...stats,
      totalSetsLogged: stats.totalSetsLogged + setsCount,
      totalVolumeLoad: stats.totalVolumeLoad + volumeLoad,
      totalWorkoutDurationSec: stats.totalWorkoutDurationSec + durationSec,
      lastUpdatedAt: now,
    });
    return;
  }

  await db.stats.put({
    ...stats,
    totalSetsLogged: stats.totalSetsLogged - old.setsCount + setsCount,
    totalVolumeLoad: stats.totalVolumeLoad - old.volumeLoad + volumeLoad,
    totalWorkoutDurationSec: stats.totalWorkoutDurationSec - old.durationSec + durationSec,
    lastUpdatedAt: now,
  });
}

export async function recomputeGlobalStats(): Promise<void> {
  const now = Date.now();
  const all = await db.sessionStats.toArray();
  const totals = all.reduce((acc, s) => {
    acc.totalSetsLogged += s.setsCount;
    acc.totalVolumeLoad += s.volumeLoad;
    acc.totalWorkoutDurationSec += s.durationSec;
    return acc;
  }, { totalSetsLogged: 0, totalVolumeLoad: 0, totalWorkoutDurationSec: 0 });

  const completedCount = await db.sessions.where('state').equals('ARCHIVED').count();
  await db.stats.put({
    id: 'GLOBAL',
    totalSessionsCompleted: completedCount,
    ...totals,
    lastUpdatedAt: now,
  });
}
