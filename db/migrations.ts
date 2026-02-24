import { db } from './db'

export async function ensureDefaultRows(): Promise<void> {
  const now = Date.now();

  await db.transaction('rw', db.settings, db.stats, async () => {
    const settings = await db.settings.get('USER');
    if (!settings) {
      await db.settings.put({
        id: 'USER',
        themeMode: 'SYSTEM',
        anchorWeekday: 0, // Sunday by default
        defaultRestWeekdays: [0], // Sunday rest default (user can change)
        units: { weightUnit: 'KG' },
        backupReminder: { enabled: true, remindAfterDays: 14 },
        createdAt: now,
        updatedAt: now,
      });
    }
    const stats = await db.stats.get('GLOBAL');
    if (!stats) {
      await db.stats.put({
        id: 'GLOBAL',
        totalSessionsCompleted: 0,
        totalSetsLogged: 0,
        totalVolumeLoad: 0,
        totalWorkoutDurationSec: 0,
        lastUpdatedAt: now,
      });
    }
  });
}
