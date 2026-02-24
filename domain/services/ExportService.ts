import { db } from '../../db/db'
import { fmtDate } from '../../utils/format'
import { ulid } from '../../utils/ulid'

export async function exportMarkdownFullHistory(): Promise<Blob> {
  // Notion-ready: headings + bullet lists; keep simple and deterministic
  const sessions = await db.sessions.orderBy('date').toArray();
  const bodyweights = await db.bodyweights.orderBy('date').toArray();
  const prs = await db.prs.toArray();
  const exercises = await db.exercises.toArray();

  const exName = new Map(exercises.map(e => [e.id, e.name]));
  const lines: string[] = [];

  lines.push('# Workout History Export');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## PR Summary');
  if (prs.length === 0) {
    lines.push('- (none)');
  } else {
    for (const pr of prs.sort((a,b)=> (exName.get(a.exerciseId) ?? '').localeCompare(exName.get(b.exerciseId) ?? ''))) {
      lines.push(`- **${exName.get(pr.exerciseId) ?? pr.exerciseId}**: ${pr.value} (max load) — ${new Date(pr.achievedAt).toLocaleDateString()}`);
    }
  }
  lines.push('');

  lines.push('## Bodyweight');
  if (bodyweights.length === 0) {
    lines.push('- (none)');
  } else {
    for (const bw of bodyweights) {
      lines.push(`- ${fmtDate(bw.date)}: ${bw.weight} ${bw.unit}`);
    }
  }
  lines.push('');

  lines.push('## Sessions');
  const sessionByDate = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const arr = sessionByDate.get(s.date) ?? [];
    arr.push(s);
    sessionByDate.set(s.date, arr);
  }
  for (const [date, sessArr] of [...sessionByDate.entries()].sort((a,b)=> a[0].localeCompare(b[0]))) {
    lines.push(`### ${fmtDate(date)}`);
    for (const s of sessArr) {
      lines.push(`- **Session** (${s.state})${s.dayTemplateId ? '' : ' (ad-hoc)'}`);
      if (s.startedAt) lines.push(`  - Started: ${new Date(s.startedAt).toLocaleTimeString()}`);
      if (s.finishedAt) lines.push(`  - Finished: ${new Date(s.finishedAt).toLocaleTimeString()}`);
      if (s.durationSec != null) lines.push(`  - Duration: ${Math.round(s.durationSec/60)} min`);

      const sesEx = await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order');
      for (const se of sesEx) {
        lines.push(`  - **${exName.get(se.exerciseId) ?? se.exerciseId}**`);
        const sets = await db.sets.where('sessionExerciseId').equals(se.id).sortBy('order');
        for (const set of sets) {
          const parts: string[] = [];
          parts.push(set.setType);
          if (typeof set.reps === 'number') parts.push(`${set.reps} reps`);
          if (typeof set.load === 'number') parts.push(`${set.load} load`);
          if (typeof set.rir === 'number') parts.push(`RIR ${set.rir}`);
          if (typeof set.durationSec === 'number') parts.push(`${set.durationSec}s`);
          if (typeof set.distance === 'number') parts.push(`${set.distance} dist`);
          lines.push(`    - ${parts.join(' • ')}`);
        }
      }

      if (s.endLog) {
        lines.push('  - **End Log**');
        lines.push(`    - Performance: ${s.endLog.performance}/5`);
        lines.push(`    - Energy: ${s.endLog.energy}/5`);
        lines.push(`    - Mind-muscle: ${s.endLog.mindMuscle}/5`);
        if (s.endLog.mentalState) lines.push(`    - Mental: ${s.endLog.mentalState}`);
        if (s.endLog.preWorkoutUsed) lines.push(`    - Pre-workout: ${s.endLog.preWorkoutUsed}`);
      }
    }
    lines.push('');
  }

  return new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function recordExport(): Promise<void> {
  const now = Date.now();
  await db.exports.put({ id: ulid(), type: 'MARKDOWN_FULL_HISTORY', createdAt: now });
  const s = await db.settings.get('USER');
  if (s) await db.settings.put({ ...s, backupReminder: { ...s.backupReminder, lastExportAt: now }, updatedAt: now });
}
