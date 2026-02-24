import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import { useSessionStore } from '../../state/sessionStore'
import { fmtDuration } from '../../utils/format'
import { addOrSwapExercise, logSet, deleteSet, updateSet } from '../../domain/services/SessionService'
import TimerChip from '../components/TimerChip'
import SetRow from '../components/SetRow'
import HistoryPanel from '../components/HistoryPanel'
import Modal from '../components/Modal'

export default function TrackerPage() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const setActiveSession = useSessionStore(s => s.setActiveSession);
  const activeSessionExerciseId = useSessionStore(s => s.activeSessionExerciseId);
  const setActiveSessionExercise = useSessionStore(s => s.setActiveSessionExercise);
  const rest = useSessionStore(s => s.rest);
  const startRest = useSessionStore(s => s.startRest);
  const clearRest = useSessionStore(s => s.clearRest);
  const setRestDuration = useSessionStore(s => s.setRestDuration);
  const setAutoStart = useSessionStore(s => s.setAutoStart);
  const setRestEnabled = useSessionStore(s => s.setRestEnabled);

  const [session, setSession] = useState<any | null>(null);
  const [sesEx, setSesEx] = useState<any[]>([]);
  const [exercises, setExercises] = useState<any[]>([]);
  const [sets, setSets] = useState<any[]>([]);
  const [editSet, setEditSet] = useState<any | null>(null);
  const [exercisePicker, setExercisePicker] = useState<{ open: boolean; mode: 'ADD'|'SWAP'; targetId?: string } | null>(null);
  const [resetPrompt, setResetPrompt] = useState(false);
  const [stopPrompt, setStopPrompt] = useState(false);

  const sid = sessionId!;
  useEffect(() => { setActiveSession(sid); return () => setActiveSession(null); }, [sid, setActiveSession]);

  useEffect(() => {
    (async () => {
      const s = await db.sessions.get(sid);
      setSession(s ?? null);
      const se = await db.sessionExercises.where('sessionId').equals(sid).sortBy('order');
      setSesEx(se);
      if (!activeSessionExerciseId && se.length) setActiveSessionExercise(se[0]!.id);
      const exIds = Array.from(new Set(se.map(x=>x.exerciseId)));
      const ex = exIds.length ? await db.exercises.where('id').anyOf(exIds).toArray() : [];
      setExercises(ex);
      const allSets = await db.sets.where('sessionId').equals(sid).toArray();
      setSets(allSets);
    })();
  }, [sid, activeSessionExerciseId, setActiveSessionExercise]);

  const title = session?.dayTemplateId ? (awaitTitle(session.dayTemplateId)) : (session ? 'Workout' : 'Workout');
  const startedAt = session?.startedAt ?? Date.now();
  const elapsedSec = useMemo(() => Math.floor((Date.now() - startedAt)/1000), [startedAt]);

  const currentSE = sesEx.find(x=>x.id === activeSessionExerciseId) ?? sesEx[0];
  const currentEx = exercises.find(x=>x.id === currentSE?.exerciseId);

  const currentSets = useMemo(() => sets.filter(s => s.sessionExerciseId === currentSE?.id).sort((a,b)=>a.order-b.order), [sets, currentSE]);
  const nextSE = useMemo(() => {
    if (!currentSE) return null;
    const idx = sesEx.findIndex(x=>x.id===currentSE.id);
    return sesEx[idx+1] ?? null;
  }, [sesEx, currentSE]);

  const prevText = useMemo(() => {
    // simplified: show last week's max load for this exercise from any session on date-7
    if (!session?.date || !currentEx) return undefined;
    const [y,m,d] = session.date.split('-').map(Number);
    const dt = new Date(y, (m??1)-1, d??1);
    dt.setDate(dt.getDate()-7);
    const prev = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    return (async () => {
      const prevSess = await db.sessions.where('date').equals(prev).and(s=>s.dayTemplateId===session.dayTemplateId).first();
      if (!prevSess) return undefined;
      const prevSets = await db.sets.where('sessionId').equals(prevSess.id).toArray();
      const w = prevSets.filter(ps => ps.exerciseId===currentEx.id && ps.setType==='WORKING');
      if (!w.length) return undefined;
      const maxLoad = w.reduce((m,x)=> typeof x.load==='number' ? Math.max(m,x.load) : m, 0);
      const totalSets = w.length;
      return `${totalSets} working sets • max load ${maxLoad}`;
    })();
  }, [session?.date, session?.dayTemplateId, currentEx?.id]);

  const [prevWeekText, setPrevWeekText] = useState<string | undefined>(undefined);
  useEffect(() => { void (prevText?.then(setPrevWeekText) ?? Promise.resolve()); }, [prevText]);

  async function refresh() {
    const se = await db.sessionExercises.where('sessionId').equals(sid).sortBy('order');
    setSesEx(se);
    const exIds = Array.from(new Set(se.map(x=>x.exerciseId)));
    const ex = exIds.length ? await db.exercises.where('id').anyOf(exIds).toArray() : [];
    setExercises(ex);
    const allSets = await db.sets.where('sessionId').equals(sid).toArray();
    setSets(allSets);
    setSession(await db.sessions.get(sid));
  }

  async function deleteSessionAndData() {
    // Delete session + sets + sessionExercises; unlink schedule if linked
    const s = await db.sessions.get(sid);
    const sch = s?.scheduleId ? await db.schedule.get(s.date as any).catch(()=>null) : null;
    await db.transaction('rw', db.sessions, db.sets, db.sessionExercises, db.schedule, async () => {
      await db.sets.where('sessionId').equals(sid).delete();
      await db.sessionExercises.where('sessionId').equals(sid).delete();
      await db.sessions.delete(sid);
      if (sch?.linkedSessionId === sid) {
        await db.schedule.put({ ...sch, linkedSessionId: null, state: 'PLANNED', updatedAt: Date.now() });
      }
    });
  }

async function onLogSet(payload: any) {
    if (!currentSE) return;
    // optimistic UI: add temporary row
    const tempId = `tmp_${Math.random().toString(16).slice(2)}`;
    const temp = { id: tempId, sessionId: sid, sessionExerciseId: currentSE.id, exerciseId: currentSE.exerciseId, createdAt: Date.now(), order: currentSets.length+1, ...payload };
    setSets((s)=> [...s, temp]);
    try {
      const id = await logSet(sid, currentSE.id, payload);
      // replace temp
      setSets((s)=> s.map(x => x.id === tempId ? { ...x, id } : x));
      if (rest.enabled && rest.autoStart) startRest(Date.now());
    } catch {
      setSets((s)=> s.filter(x => x.id !== tempId));
      alert('Failed to log set.');
    }
  }

  if (!session) return <div className="card">Loading…</div>;

  return (
    <>
      <div className="row between">
        <div>
          <div className="h1">{session.dayTemplateId ? 'Workout' : 'Ad-hoc workout'}</div>
          <div className="muted">{fmtDuration(elapsedSec)}</div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button className="ghost" onClick={() => setStopPrompt(true)}>Stop</button>
          <button className="danger" onClick={() => setResetPrompt(true)}>Reset</button>
          <button className="primary" onClick={() => nav(`/endlog/${sid}`)}>Finish</button>
        </div>
      </div>

      <div className="chip" style={{ marginBottom: 10 }}>Next: {nextSE ? (exercises.find(e=>e.id===nextSE.exerciseId)?.name ?? nextSE.exerciseId) : '—'}</div>

      <HistoryPanel text={prevWeekText} />

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row between">
          <div>
            <div className="h2">{currentEx?.name ?? currentSE?.exerciseId ?? 'Exercise'}</div>
            <div className="muted" style={{ fontSize: 12 }}>{currentSets.length} sets</div>
          </div>
          <div className="row">
            <button className="ghost" onClick={() => setExercisePicker({ open: true, mode: 'SWAP', targetId: currentSE?.id })}>Swap</button>
            <button className="ghost" onClick={() => setExercisePicker({ open: true, mode: 'ADD' })}>Add</button>
          </div>
        </div>

        <div className="hr" />

        <SetEntry onSubmit={onLogSet} />

        <div className="hr" />

        <div className="row between">
          <div className="row" style={{ gap: 10 }}>
            <label style={{ margin: 0, display:'flex', alignItems:'center', gap: 8 }}>
              <input type="checkbox" checked={rest.enabled} onChange={(e)=> setRestEnabled(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span className="muted">Rest timer</span>
            </label>
            <label style={{ margin: 0, display:'flex', alignItems:'center', gap: 8 }}>
              <input type="checkbox" checked={rest.autoStart} onChange={(e)=> setAutoStart(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span className="muted">Auto</span>
            </label>
          </div>
          <div style={{ width: 120 }}>
            <input
              inputMode="numeric"
              value={rest.durationSec}
              onChange={(e)=> setRestDuration(Number(e.target.value || 0))}
              aria-label="Rest duration seconds"
            />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <TimerChip startedAt={rest.startedAt} durationSec={rest.durationSec} onClear={clearRest} />
        </div>

        <div className="hr" />

        {currentSets.map((s, idx) => (
          <SetRow
            key={s.id}
            idx={idx+1}
            setType={s.setType}
            reps={s.reps}
            load={s.load}
            rir={s.rir}
            createdAt={s.createdAt}
            editable={session.state === 'ARCHIVED'} // edits via Data page; keep tracker read-only for archived
            onEdit={() => {}}
            onDelete={() => {}}
          />
        ))}

        <div className="hr" />

        <div className="row between">
          <button className="ghost" disabled={!currentSE || sesEx[0]?.id === currentSE.id} onClick={() => {
            const idx = sesEx.findIndex(x=>x.id===currentSE.id);
            const prev = sesEx[idx-1];
            if (prev) setActiveSessionExercise(prev.id);
          }}>Prev</button>
          <button className="ghost" disabled={!nextSE} onClick={() => { if (nextSE) setActiveSessionExercise(nextSE.id); }}>Next</button>
        </div>
      </div>

      {exercisePicker?.open ? (
        <ExercisePicker
          mode={exercisePicker.mode}
          targetId={exercisePicker.targetId}
          onClose={() => setExercisePicker(null)}
          onPick={async (exerciseId) => {
            await addOrSwapExercise(sid, { mode: exercisePicker.mode, sessionExerciseId: exercisePicker.targetId, exerciseId });
            setExercisePicker(null);
            await refresh();
          }}
        />
      ) : null}
    {stopPrompt ? (
  <Modal
    title="Stop workout"
    onClose={() => setStopPrompt(false)}
    actions={
      <>
        <button className="ghost" onClick={() => setStopPrompt(false)}>Cancel</button>
        <button className="primary" onClick={() => { setStopPrompt(false); nav(`/endlog/${sid}`); }}>End session</button>
      </>
    }
  >
    <div className="muted">Stop will end the session and open the End Log.</div>
  </Modal>
) : null}

{resetPrompt ? (
  <Modal
    title="Reset workout"
    onClose={() => setResetPrompt(false)}
    actions={
      <>
        <button className="ghost" onClick={() => setResetPrompt(false)}>Cancel</button>
        <button className="danger" onClick={async () => {
          setResetPrompt(false);
          await deleteSessionAndData();
          nav(`/workout/today`);
        }}>Delete</button>
      </>
    }
  >
    <div className="muted">This will permanently delete the current session and all logged sets.</div>
  </Modal>
) : null}

    </>
  );
}

function SetEntry({ onSubmit }:{ onSubmit: (p:any)=>void }) {
  const [reps, setReps] = useState<string>('');
  const [load, setLoad] = useState<string>('');
  const [rir, setRir] = useState<string>('');
  const [setType, setSetType] = useState<'WARMUP'|'WORKING'>('WORKING');

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', alignItems:'end' }}>
      <div>
        <label>Reps</label>
        <input inputMode="numeric" value={reps} onChange={(e)=>setReps(e.target.value)} />
      </div>
      <div>
        <label>Load</label>
        <input inputMode="decimal" value={load} onChange={(e)=>setLoad(e.target.value)} />
      </div>
      <div>
        <label>RIR</label>
        <input inputMode="numeric" value={rir} onChange={(e)=>setRir(e.target.value)} />
      </div>
      <div className="row" style={{ gridColumn:'1 / -1', justifyContent:'space-between' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className={setType==='WARMUP'?'primary':''} onClick={() => setSetType('WARMUP')} type="button">Warmup</button>
          <button className={setType==='WORKING'?'primary':''} onClick={() => setSetType('WORKING')} type="button">Working</button>
        </div>
        <button className="primary" type="button" onClick={() => {
          const payload = {
            setType,
            reps: reps === '' ? undefined : Number(reps),
            load: load === '' ? undefined : Number(load),
            rir: rir === '' ? undefined : Number(rir),
          };
          onSubmit(payload);
          // keep inputs for fast logging; only clear reps/load optionally
        }}>Log set</button>
      </div>
    </div>
  );
}

function ExercisePicker({ mode, targetId, onClose, onPick }:{
  mode: 'ADD'|'SWAP';
  targetId?: string;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
}) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    (async () => {
      const all = await db.exercises.where('archived').equals(0 as any).toArray().catch(()=>db.exercises.toArray());
      setList(all);
    })();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return qq ? list.filter(e => e.name.toLowerCase().includes(qq)) : list;
  }, [q, list]);

  return (
    <Modal
      title={mode === 'ADD' ? 'Add exercise' : 'Swap exercise'}
      onClose={onClose}
      actions={<button className="ghost" onClick={onClose}>Close</button>}
    >
      <div className="grid">
        <div>
          <label>Search</label>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Type to filter…" />
        </div>
        <div className="card" style={{ boxShadow: 'none' }}>
          {filtered.slice(0, 20).map(e => (
            <button key={e.id} className="ghost" style={{ width:'100%', textAlign:'left' }} onClick={() => onPick(e.id)}>{e.name}</button>
          ))}
          {filtered.length === 0 ? <div className="muted">No matches.</div> : null}
        </div>

        <button className="primary" onClick={() => setCreating(v=>!v)}>{creating ? 'Cancel new exercise' : 'New exercise'}</button>
        {creating ? (
          <div className="card" style={{ boxShadow:'none' }}>
            <label>Name</label>
            <input value={newName} onChange={(e)=>setNewName(e.target.value)} />
            <div className="row" style={{ marginTop: 10, justifyContent:'flex-end' }}>
              <button className="primary" onClick={async () => {
                const name = newName.trim();
                if (!name) return;
                const id = crypto.randomUUID().replace(/-/g,'').slice(0,26).toUpperCase();
                await db.exercises.put({ id, name, type:'STRENGTH', defaultUnit:'KG', archived:false, createdAt: Date.now(), updatedAt: Date.now() });
                onPick(id);
              }}>Create + select</button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

async function awaitTitle(dayTemplateId: string): Promise<string> {
  const dt = await db.dayTemplates.get(dayTemplateId);
  return dt?.title ?? 'Workout';
}
