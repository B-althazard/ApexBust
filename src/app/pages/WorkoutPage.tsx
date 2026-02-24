import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import { toYMD } from '../../utils/date'
import { startSessionFromSchedule } from '../../domain/services/SessionService'
import ExerciseCard from '../components/ExerciseCard'
import Modal from '../components/Modal'
import { convertWorkoutToRest, insertRestDay, generateWeekSchedule } from '../../domain/services/ScheduleService'
import { useSettingsStore } from '../../state/settingsStore'

export default function WorkoutPage() {
  const params = useParams();
  const nav = useNavigate();
  const settings = useSettingsStore(s => s.settings);

  const date = params.date === 'today' || !params.date ? toYMD(new Date()) : params.date!;
  const [schedule, setSchedule] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [exList, setExList] = useState<any[]>([]);
  const [swapPrompt, setSwapPrompt] = useState<{ open: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      if (settings) await generateWeekSchedule(date); // ensure schedule exists around selected date
      const sch = await db.schedule.get({ date } as any);
      setSchedule(sch ?? null);
      const s = sch?.linkedSessionId ? await db.sessions.get(sch.linkedSessionId) : await db.sessions.where('date').equals(date).first();
      setSession(s ?? null);

      if (sch?.dayTemplateId) {
        const des = await db.dayExercises.where('dayTemplateId').equals(sch.dayTemplateId).sortBy('order');
        const exIds = des.map(d=>d.exerciseId);
        const exercises = exIds.length ? await db.exercises.where('id').anyOf(exIds).toArray() : [];
        const byId = new Map(exercises.map(e=>[e.id,e]));
        // previous week snippet: use sets of previous week scheduled day if exists
        const prevSch = await db.schedule.get({ date: prevYMD(date), dayTemplateId: sch.dayTemplateId } as any).catch(()=>null);
        const prevSess = prevSch?.linkedSessionId ? await db.sessions.get(prevSch.linkedSessionId) : null;
        let prevSets: any[] = [];
        if (prevSess) prevSets = await db.sets.where('sessionId').equals(prevSess.id).toArray();

        setExList(des.map(de => {
          const ex = byId.get(de.exerciseId);
          const ssets = prevSets.filter(ps => ps.exerciseId === de.exerciseId && ps.setType === 'WORKING');
          const maxLoad = ssets.reduce((m,x)=> typeof x.load==='number' ? Math.max(m,x.load) : m, 0);
          const reps = ssets.length ? ssets[ssets.length-1]?.reps : undefined;
          const snippet = ssets.length ? `max ${maxLoad}${reps?` • last reps ${reps}`:''}` : undefined;
          return { de, ex, snippet };
        }));
      } else {
        setExList([]);
      }
    })();
  }, [date, settings]);

  const cta = useMemo(() => {
    if (!schedule) return { label: 'Start', mode: 'START' as const };
    if (session?.state === 'IN_PROGRESS') return { label: 'Resume', mode: 'RESUME' as const };
    if (schedule.state === 'COMPLETED') return { label: 'View', mode: 'VIEW' as const };
    return { label: 'Start', mode: 'START' as const };
  }, [schedule, session]);

  async function onPrimary() {
    if (cta.mode === 'VIEW' && schedule?.linkedSessionId) {
      nav(`/tracker/${schedule.linkedSessionId}`);
      return;
    }
    const id = await startSessionFromSchedule(date);
    nav(`/tracker/${id}`);
  }

  if (!schedule) {
    return (
      <>
        <div className="h1">Workout</div>
        <div className="card">
          <div className="muted">No schedule entry for this date yet.</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={() => void generateWeekSchedule(date).then(()=>window.location.reload())}>Generate week</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="h1">{schedule.type === 'WORKOUT' ? (schedule.title ?? 'Workout') : 'Rest day'}</div>
      <div className="muted" style={{ marginBottom: 10 }}>{date}</div>

      {schedule.type === 'WORKOUT' ? (
        <>
          <div className="grid">
            {exList.map(({de, ex, snippet}) => (
              <ExerciseCard
                key={de.id}
                name={ex?.name ?? de.exerciseId}
                prescription={de.prescription}
                lastWeekSnippet={snippet}
              />
            ))}
          </div>

          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="primary" onClick={() => void onPrimary()}>{cta.label}</button>
            {schedule.state === 'PLANNED' ? (
              <>
                <button className="ghost" onClick={() => setSwapPrompt({ open: true })}>Insert rest day</button>
                <button className="ghost" onClick={() => void convertWorkoutToRest(date).then(()=>window.location.reload())}>Convert to rest</button>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="muted">Rest day.</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="primary" onClick={async () => {
              // ad-hoc workout: convert to WORKOUT with no template
              await db.schedule.put({ ...schedule, type:'WORKOUT', title:'Ad-hoc workout', dayTemplateId:null, programId:null, programVersionId:null, state:'PLANNED', updatedAt: Date.now() });
              window.location.reload();
            }}>Convert to workout</button>
          </div>
        </div>
      )}

      {swapPrompt?.open ? (
        <Modal
          title="Insert extra rest day"
          onClose={() => setSwapPrompt(null)}
          actions={
            <>
              <button className="ghost" onClick={() => setSwapPrompt(null)}>Cancel</button>
              <button className="primary" onClick={async () => {
                const res = await insertRestDay(date);
                setSwapPrompt(null);
                alert(res.swapped ? 'Swapped with a default rest day.' : 'No rest day available to swap; week shortened.');
                window.location.reload();
              }}>Swap with default rest day</button>
              <button className="danger" onClick={async () => {
                // NO path: shorten week
                await db.schedule.put({ ...schedule, type:'REST', title:'Rest', updatedAt: Date.now() });
                setSwapPrompt(null);
                window.location.reload();
              }}>No (shorten week)</button>
            </>
          }
        >
          <div className="muted">Do you want to preserve the weekly structure by swapping with a default rest day?</div>
        </Modal>
      ) : null}
    </>
  );
}

function prevYMD(date: string): string {
  const [y,m,d] = date.split('-').map(Number);
  const dt = new Date(y, (m??1)-1, d??1);
  dt.setDate(dt.getDate()-7);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}
