import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../../state/settingsStore'
import { importProgram } from '../../domain/services/ProgramService'
import { generateWeekSchedule } from '../../domain/services/ScheduleService'
import { exportMarkdownFullHistory, download, recordExport } from '../../domain/services/ExportService'
import Modal from '../components/Modal'
import { toYMD } from '../../utils/date'

export default function SettingsPage() {
  const s = useSettingsStore(x => x.settings);
  const load = useSettingsStore(x => x.load);
  const setThemeMode = useSettingsStore(x => x.setThemeMode);
  const setAnchorWeekday = useSettingsStore(x => x.setAnchorWeekday);
  const setDefaultRestWeekdays = useSettingsStore(x => x.setDefaultRestWeekdays);
  const setWeightUnit = useSettingsStore(x => x.setWeightUnit);
  const setBackupReminder = useSettingsStore(x => x.setBackupReminder);

  const [importText, setImportText] = useState('');
  const [importAnchor, setImportAnchor] = useState<number | null>(null);

  useEffect(() => { void load(); }, [load]);

  const backupDue = useMemo(() => {
    if (!s?.backupReminder.enabled) return false;
    const last = s.backupReminder.lastExportAt ?? 0;
    const days = s.backupReminder.remindAfterDays;
    return Date.now() - last > days * 24 * 3600 * 1000;
  }, [s]);

  if (!s) return <div className="card">Loading…</div>;

  return (
    <>
      <div className="h1">Settings</div>

      <div className="grid">
        <div className="card">
          <div className="h2">Theme</div>
          <select value={s.themeMode} onChange={(e)=> void setThemeMode(e.target.value as any)}>
            <option value="SYSTEM">System</option>
            <option value="LIGHT">Light</option>
            <option value="DARK">Dark</option>
          </select>
        </div>

        <div className="card">
          <div className="h2">Units</div>
          <select value={s.units.weightUnit} onChange={(e)=> void setWeightUnit(e.target.value as any)}>
            <option value="KG">KG</option>
            <option value="LB">LB</option>
          </select>
        </div>

        <div className="card">
          <div className="h2">Schedule</div>
          <label>Anchor weekday (0=Sun … 6=Sat)</label>
          <input inputMode="numeric" value={s.anchorWeekday} onChange={(e)=> void setAnchorWeekday(clampWD(Number(e.target.value)))} />
          <div className="hr" />
          <label>Default rest weekdays (comma-separated, 0..6)</label>
          <input value={s.defaultRestWeekdays.join(',')} onChange={(e)=> {
            const wds = e.target.value.split(',').map(x=>Number(x.trim())).filter(n=>Number.isFinite(n) && n>=0 && n<=6);
            void setDefaultRestWeekdays(wds);
          }} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={() => void generateWeekSchedule(toYMD(new Date())).then(()=>alert('Week generated (non-destructive).'))}>Generate current week</button>
          </div>
        </div>

        <div className="card">
          <div className="h2">Program import</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Paste JSON for: full program, single day, or single exercise (v1 implements full program import).</div>
          <textarea rows={8} value={importText} onChange={(e)=>setImportText(e.target.value)} />
          <div className="row" style={{ justifyContent:'flex-end', marginTop: 10 }}>
            <button className="primary" onClick={async () => {
              const text = importText.trim();
              if (!text) return;
              const json = JSON.parse(text);
              const res = await importProgram(json);
              setImportText('');
              if (typeof res.importedAnchorWeekday === 'number') {
                setImportAnchor(res.importedAnchorWeekday);
              } else {
                await generateWeekSchedule(toYMD(new Date()));
                alert('Imported.');
              }
            }}>Import</button>
          </div>
        </div>

        <div className="card">
          <div className="h2">Backup reminder</div>
          {backupDue ? <div className="chip">⚠️ Backup recommended</div> : <div className="muted" style={{ fontSize: 12 }}>OK</div>}
          <div className="hr" />
          <label>Enabled</label>
          <select value={String(s.backupReminder.enabled)} onChange={(e)=> void setBackupReminder({ enabled: e.target.value === 'true' })}>
            <option value="true">On</option>
            <option value="false">Off</option>
          </select>
          <div style={{ marginTop: 10 }}>
            <label>Remind after days</label>
            <input inputMode="numeric" value={s.backupReminder.remindAfterDays} onChange={(e)=> void setBackupReminder({ remindAfterDays: Math.max(1, Number(e.target.value||14)) })} />
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Last export: {s.backupReminder.lastExportAt ? new Date(s.backupReminder.lastExportAt).toLocaleString() : 'never'}
          </div>
        </div>

        <div className="card">
          <div className="h2">Export</div>
          <button className="primary" onClick={async () => {
            const blob = await exportMarkdownFullHistory();
            download(blob, `workout-history-${new Date().toISOString().slice(0,10)}.md`);
            await recordExport();
            await load();
          }}>Export Markdown (full history)</button>
        </div>
      </div>

      {importAnchor != null ? (
        <Modal
          title="Import includes anchor weekday"
          onClose={() => setImportAnchor(null)}
          actions={
            <>
              <button className="ghost" onClick={async () => {
                // ignore
                setImportAnchor(null);
                await generateWeekSchedule(toYMD(new Date()));
                alert('Imported (anchor ignored).');
              }}>Ignore</button>
              <button className="primary" onClick={async () => {
                await setAnchorWeekday(importAnchor);
                setImportAnchor(null);
                await generateWeekSchedule(toYMD(new Date()));
                alert('Imported + anchor applied.');
              }}>Apply</button>
            </>
          }
        >
          <div className="muted">Use imported anchor weekday <span className="kbd">{importAnchor}</span> as the global setting?</div>
        </Modal>
      ) : null}
    </>
  )
}

function clampWD(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(6, Math.max(0, Math.floor(n)));
}
