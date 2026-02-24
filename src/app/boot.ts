import { ensureDefaultRows } from '../db/migrations'
import { acquireInstanceLockOrThrow } from '../domain/services/ConcurrencyService'
import { runStartupPrompts } from '../domain/services/StartupPrompts'

export async function boot(): Promise<void> {
  await acquireInstanceLockOrThrow()
  await ensureDefaultRows()
  await runStartupPrompts()
}
