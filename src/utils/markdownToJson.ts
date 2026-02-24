import type { ProgramImportV1 } from '../domain/services/ProgramService'

type DayBlock = { dayNum: number; title: string; body: string };

const DAY_HEADER_RE = /^#\s+.*Day\s+(\d+)\s+—\s+(.+)$/mi;

function cleanTitle(t: string): string {
  return t.replace(/^[^A-Za-z0-9]+\s*/,'').trim();
}

function findDayBlocks(markdown: string): DayBlock[] {
  const lines = markdown.split(/\r?\n/);
  const metas: Array<{ dayNum: number; title: string; start: number }> = [];
  for (let i=0;i<lines.length;i++) {
    const m = lines[i]?.match(DAY_HEADER_RE);
    if (m) metas.push({ dayNum: Number(m[1]), title: cleanTitle(m[2] ?? `Day ${m[1]}`), start: i });
  }
  if (metas.length === 0) {
    const h1 = markdown.match(/^#\s+(.+)$/m);
    if (!h1) return [];
    const m2 = h1[1].match(/Day\s+(\d+)/i);
    const dayNum = m2 ? Number(m2[1]) : 1;
    return [{ dayNum, title: cleanTitle(h1[1]), body: markdown }];
  }
  const out: DayBlock[] = [];
  for (let i=0;i<metas.length;i++) {
    const start = metas[i]!.start;
    const end = (i+1 < metas.length) ? metas[i+1]!.start : lines.length;
    out.push({ dayNum: metas[i]!.dayNum, title: metas[i]!.title, body: lines.slice(start, end).join('\n') });
  }
  return out;
}

function nearestHeading(text: string, idx: number): string {
  const before = text.slice(0, idx);
  const m = [...before.matchAll(/^###\s+(.+)$/gm)];
  return (m.length ? m[m.length-1]![1] : 'Sets')?.trim() ?? 'Sets';
}

function extractPrescription(sectionBody: string): any {
  const tables = [...sectionBody.matchAll(/\n\|\s*Set\s*\|[\s\S]*?\n\|[-:\s|]+\n([\s\S]*?)(?=\n\n|\n---|\n###\s+|\Z)/g)];
  let workingSets = 0;
  let targetReps: string | undefined;
  const parts: string[] = [];

  for (const t of tables) {
    const rowsBody = (t[1] ?? '').trim();
    if (!rowsBody) continue;
    const rows = rowsBody.split(/\r?\n/).filter(r => /^\|/.test(r));
    if (!rows.length) continue;

    const firstCells = rows[0]!.split('|').map(x=>x.trim()).filter(Boolean);
    const repsVal = firstCells[1];
    if (!targetReps && repsVal) targetReps = repsVal;

    const heading = nearestHeading(sectionBody, t.index ?? 0);
    parts.push(`${heading}: ${rows.length} sets`);
    if (!/warm-?up/i.test(heading)) workingSets += rows.length;
  }

  const out: any = {};
  if (workingSets > 0) out.targetSets = workingSets;
  if (targetReps) out.targetReps = targetReps;
  if (parts.length) out.notes = parts.join(' • ');
  return Object.keys(out).length ? out : undefined;
}

function parseExercises(dayMarkdown: string): Array<{ name: string; order: number; prescription?: any; isWarmupDefault?: boolean }> {
  const lines = dayMarkdown.split(/\r?\n/);
  const out: Array<{ name: string; order: number; prescription?: any; isWarmupDefault?: boolean }> = [];
  let order = 1;
  let inWarmup = false;

  for (let i=0;i<lines.length;i++) {
    const line = (lines[i] ?? '').trim();
    if (/^#\s+General Warm-Up\s*$/i.test(line)) inWarmup = true;
    if (/^#\s+Accessories\s*$/i.test(line)) inWarmup = false;
    if (/^#\s+Cooldown\s*$/i.test(line)) inWarmup = true;

    const h2 = line.match(/^##\s+(.+)$/);
    if (!h2) continue;

    const name = (h2[1] ?? '').trim();
    if (!name || /^Intro$/i.test(name)) continue;

    let end = lines.length;
    for (let j=i+1;j<lines.length;j++) {
      if (/^##\s+/.test((lines[j] ?? '').trim())) { end = j; break; }
    }
    const body = lines.slice(i+1, end).join('\n');
    out.push({
      name: name.replace(/\s+\(.+\)\s*$/,'').trim(),
      order: order++,
      prescription: extractPrescription(body),
      isWarmupDefault: inWarmup,
    });
  }
  return out;
}

export function markdownToProgramJSON(markdown: string, programName: string): ProgramImportV1 {
  const blocks = findDayBlocks(markdown)
    .filter(b => b.dayNum >= 1 && b.dayNum <= 6)
    .sort((a,b)=>a.dayNum-b.dayNum);

  if (!blocks.length) throw new Error('No Day 1–Day 6 blocks detected.');

  // Decision: repeat+Day7rest.
  // Map Day1..Day6 -> weekdays 1..6 (Mon..Sat). Day7 implied rest (Sunday=0).
  const dayNumToWeekday = (dayNum: number): number => Math.min(6, Math.max(1, dayNum));

  const days = blocks.map(b => ({
    weekday: dayNumToWeekday(b.dayNum),
    title: b.title,
    exercises: parseExercises(b.body),
  }));

  const exercisesRegistry: Array<{ name: string; type?: 'STRENGTH'|'CARDIO'|'OTHER'; defaultUnit?: 'KG'|'LB'|'MIN'|'M'|'KM'|'CAL'|'NONE' }> = [];
  const seen = new Set<string>();
  for (const d of days) {
    for (const e of d.exercises) {
      const key = e.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      exercisesRegistry.push({ name: e.name, type: 'STRENGTH', defaultUnit: 'KG' });
    }
  }

  return {
    schemaVersion: 1,
    program: {
      name: programName,
      weekTemplate: {
        name: 'BASE_Workout',
        days: days.map(d => ({
          weekday: d.weekday,
          title: d.title,
          exercises: d.exercises.map(e => ({
            name: e.name,
            order: e.order,
            prescription: e.prescription,
            isWarmupDefault: e.isWarmupDefault ?? false,
          })),
        })),
      },
    },
    exercises: exercisesRegistry,
  };
}
