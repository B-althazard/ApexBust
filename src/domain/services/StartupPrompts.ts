import { db } from '../../db/db'
import { addDays, toYMD } from '../../utils/date'
import { useUIStore } from '../../app/uiStore'

export async function runStartupPrompts(): Promise<void> {
  const today = toYMD(new Date());
  const yesterday = addDays(today, -1);

  const y = await db.schedule.get({ date: yesterday } as any);
  if (y && y.type === 'WORKOUT' && y.state === 'PLANNED') {
    // next-day prompt
    useUIStore.getState().setSkipPrompt({ open: true, date: yesterday });
  }

  // Backup reminder is in-app only; shown on Settings page (no system notifications)
  // Here we do nothing; Settings shows indicator based on lastExportAt.
}
