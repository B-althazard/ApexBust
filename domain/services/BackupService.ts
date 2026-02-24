import { db } from '../../db/db'

const DIR = 'apexbust_backups';

async function getRoot(): Promise<FileSystemDirectoryHandle> {
  // OPFS root directory
  // @ts-expect-error - TS lib may not include it
  return await navigator.storage.getDirectory();
}

async function ensureDir(path: string[]): Promise<FileSystemDirectoryHandle> {
  let dir = await getRoot();
  dir = await dir.getDirectoryHandle(DIR, { create: true });
  for (const seg of path) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  return dir;
}

async function writeJsonFile(dir: FileSystemDirectoryHandle, filename: string, data: any): Promise<void> {
  const fh = await dir.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

async function buildSnapshot(sessionId: string): Promise<any> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  const sessionExercises = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  const exercises = await db.exercises.where('id').anyOf(sessionExercises.map(s => s.exerciseId)).toArray();

  return {
    app: 'ApexBust',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    session,
    sessionExercises,
    sets,
    exercises,
  };
}

// TMP backups: write one file per set submission
export async function snapshotSessionToTmp(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const payload = await buildSnapshot(sessionId);
  const dir = await ensureDir(['tmp', session.date]);
  await writeJsonFile(dir, `tmp-${sessionId}-${Date.now()}.json`, payload);
}

// Internal permanent copy (OPFS)
export async function snapshotSessionFinalToInternal(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const payload = await buildSnapshot(sessionId);
  const dir = await ensureDir(['final', session.date]);
  await writeJsonFile(dir, `final-${sessionId}-${Date.now()}.json`, payload);
}

// Downloads permanent backup (Blob for browser download)
export async function buildFinalBackupBlob(sessionId: string): Promise<Blob> {
  const payload = await buildSnapshot(sessionId);
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
}

// Retention: keep tmp backups for the last complete workout day only
export async function purgeTmpBackupsKeepLastWorkoutDay(): Promise<void> {
  const latest = await db.sessions.where('state').equals('ARCHIVED').orderBy('date').last();
  if (!latest) return;
  const keepDate = latest.date;

  const root = await getRoot();
  const base = await root.getDirectoryHandle(DIR, { create: true });
  const tmp = await base.getDirectoryHandle('tmp', { create: true });

  // @ts-expect-error - async iteration exists in browsers
  for await (const [name, handle] of tmp.entries()) {
    if (name === keepDate) continue;
    if (handle.kind === 'directory') {
      // @ts-expect-error - recursive removal supported
      await tmp.removeEntry(name, { recursive: true });
    }
  }
}
