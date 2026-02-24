import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CalendarMonth, { type DayBadge } from '../components/CalendarMonth'
import { db } from '../../db/db'
import { toYMD, fromYMD, addDays, startOfAnchoredWeek } from '../../utils/date'
import { fmtDuration } from '../../utils/format'
import { useSettingsStore } from '../../state/settingsStore'
import Modal from '../components/Modal'
import { useUIStore } from '../uiStore'
import { markSkipped, performNowAndShift } from '../../domain/services/ScheduleService'

export default function HomePage() {
  const nav = useNavigate();
  const settings = useSettingsStore(s => s.settings);
  const [selected, setSelected] = useState<string>(toYMD(new Date()));
  const [schedule, setSchedule] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [prs, setPrs] = useState<any[]>([]);
  const skipPrompt = useUIStore(s => s.skipPrompt);
  const setSkipPrompt = useUIStore(s => s.setSkipPrompt);

  const year = Number(selected.slice(0,4));
  const monthIndex0 = Number(selected.slice(5,7)) - 1;

  useEffect(() => {
    (async () => {
      const s = await db.schedule.where('date').between(
        `${year}-${String(monthIndex0+1).padStart(2,'0')}-01`,
        `${year}-${String(monthIndex0+1).padStart(2,'0')}-31`,
        true, true
      ).toArray();
      setSchedule(s);
      setStats(await db.stats.get('GLOBAL'));
      setPrs(await db.prs.toArray());
    })();
  }, [year, monthIndex0]);

  const badges = useMemo(() => {
    const map: Record<string, DayBadge> = {};
    for (const e of schedule) {
      if (e.state === 'COMPLETED') map[e.date] = 'COMPLETED';
      else if (e.state === 'SKIPPED') map[e.date] = 'SKIPPED';
      else map[e.date] = e.type;
    }
    return map;
  }, [schedule]);

  const lastWeekSummary = useMemo(() => {
    if (!settings) return null;
    const today = toYMD(new Date());
    const weekStart = startOfAnchoredWeek(today, settings.anchorWeekday);
    const prevWeekStart = addDays(weekStart, -7);
    const prevWeekEnd = addDays(prevWeekStart, 6);

    return (async () => {
      const sessions = await db.sessions.where('date').between(prevWeekStart, prevWeekEnd, true, true).toArray();
      const archived = sessions.filter(s => s.state === 'ARCHIVED');
      const sessionIds = archived.map(s=>s.id);
      const sessionStats = sessionIds.length ? await db.sessionStats.where('sessionId').anyOf(sessionIds).toArray() : [];
      const totalVol = sessionStats.reduce((a,s)=>a+s.volumeLoad,0);
      const totalDur = sessionStats.reduce((a,s)=>a+s.durationSec,0);
      return { count: archived.length, totalVol, totalDur };
    })();
  }, [settings]);

  const [lw, setLw] = useState<{count:number;totalVol:number;totalDur:number} | null>(null);
  useEffect(() => { void (lastWeekSummary?.then(setLw) ?? Promise.resolve()); }, [lastWeekSummary]);

  const topPRs = useMemo(() => {
    const sorted = [...prs].sort((a,b)=> b.value-a.value).slice(0,3);
    return sorted;
  }, [prs]);

  return (
    <>
      <div className="h1">Home</div>
      <CalendarMonth
        year={year}
        monthIndex0={monthIndex0}
        badges={badges}
        selected={selected}
        onSelect={(d) => { setSelected(d); nav(`/workout/${d}`); }}
      />

      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="h2">Last week</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {lw ? `${lw.count} sessions • ${Math.round(lw.totalVol)} volume • ${fmtDuration(lw.totalDur)}` : '—'}
          </div>
        </div>

        <div className="card">
          <div className="h2">Metrics</div>
          <div className="row between" style={{ marginTop: 6 }}>
            <span className="muted">Total sessions</span>
            <span>{stats?.totalSessionsCompleted ?? 0}</span>
          </div>
          <div className="row between">
            <span className="muted">Total sets</span>
            <span>{stats?.totalSetsLogged ?? 0}</span>
          </div>
          <div className="row between">
            <span className="muted">Lifetime load</span>
            <span>{Math.round(stats?.totalVolumeLoad ?? 0)}</span>
          </div>
          <div className="hr" />
          <div className="h2">Top lifts</div>
          {topPRs.length ? topPRs.map((p) => (
            <div key={p.id} className="row between">
              <span className="muted">#{p.exerciseId.slice(0,6)}</span>
              <span>{p.value}</span>
            </div>
          )) : <div className="muted" style={{ fontSize: 12 }}>No PRs yet.</div>}
        </div>
      </div>

      {skipPrompt?.open ? (
        <Modal
          title="Yesterday's workout wasn't completed"
          onClose={() => setSkipPrompt(null)}
          actions={
            <>
              <button className="ghost" onClick={() => setSkipPrompt(null)}>Later</button>
              <button className="danger" onClick={async () => {
                await markSkipped(skipPrompt.date);
                setSkipPrompt(null);
                window.location.reload();
              }}>Skip</button>
              <button className="primary" onClick={async () => {
                const today = toYMD(new Date());
                await performNowAndShift(skipPrompt.date, today);
                setSkipPrompt(null);
                window.location.reload();
              }}>Perform now + shift</button>
            </>
          }
        >
          <div className="muted">Choose what to do with the workout scheduled for <span className="kbd">{skipPrompt.date}</span>.</div>
        </Modal>
      ) : null}
    </>
  )
}
