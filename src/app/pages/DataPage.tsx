import { useEffect, useMemo, useState } from 'react'
import { db } from '../../db/db'
import { fmtDate } from '../../utils/format'
import Modal from '../components/Modal'
import { deleteSet, saveEditedSession, updateSet } from '../../domain/services/SessionService'

export default function DataPage() {
  const [prs, setPrs] = useState<any[]>([]);
  const [stats, setStats] = useState<any | null>(null);
  const [bodyweights, setBodyweights] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [view, setView] = useState<any | null>(null); // session detail modal
  const [edit, setEdit] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setPrs(await db.prs.toArray());
    setStats(await db.stats.get('GLOBAL'));
    setBodyweights(await db.bodyweights.orderBy('date').reverse().limit(30).toArray());
    setSessions(await db.sessions.orderBy('date').reverse().toArray());
  }

  const monthSessions = useMemo(() => {
    return sessions.filter(s => s.date.startsWith(month));
  }, [sessions, month]);

  return (
    <>
      <div className="h1">Data</div>

      <div className="grid">
        <div className="card">
          <div className="h2">Lifetime stats</div>
          <div className="row between"><span className="muted">Total sessions</span><span>{stats?.totalSessionsCompleted ?? 0}</span></div>
          <div className="row between"><span className="muted">Total sets</span><span>{stats?.totalSetsLogged ?? 0}</span></div>
          <div className="row between"><span className="muted">Total load</span><span>{Math.round(stats?.totalVolumeLoad ?? 0)}</span></div>
          <div className="row between"><span className="muted">Total duration</span><span>{Math.round((stats?.totalWorkoutDurationSec ?? 0)/60)} min</span></div>
        </div>

        <div className="card">
          <div className="h2">Bodyweight</div>
          {bodyweights.length ? bodyweights.map(bw => (
            <div key={bw.id} className="row between">
              <span className="muted">{fmtDate(bw.date)}</span>
              <span>{bw.weight} {bw.unit}</span>
            </div>
          )) : <div className="muted">No entries.</div>}
          <div className="hr" />
          <AddBodyweight onAdded={refresh} />
        </div>

        <div className="card">
          <div className="h2">PRs</div>
          {prs.length ? prs.map(p => (
            <div key={p.id} className="row between">
              <span className="muted">{p.exerciseId.slice(0,6)}</span>
              <span>{p.value}</span>
            </div>
          )) : <div className="muted">No PRs yet.</div>}
        </div>

        <div className="card">
          <div className="row between">
            <div className="h2">Session history</div>
            <input value={month} onChange={(e)=>setMonth(e.target.value)} placeholder="YYYY-MM" style={{ width: 120 }} />
          </div>
          {monthSessions.length ? monthSessions.map(s => (
            <button key={s.id} className="ghost" style={{ width:'100%', textAlign:'left' }} onClick={async () => {
              const ex = await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order');
              const sets = await db.sets.where('sessionId').equals(s.id).toArray();
              setView({ session: s, ex, sets });
              setEdit(false);
            }}>
              <div className="row between">
                <span>{fmtDate(s.date)}</span>
                <span className="badge">{s.state}</span>
              </div>
            </button>
          )) : <div className="muted">No sessions in this month.</div>}
        </div>
      </div>

      {view ? (
        <Modal
          title={`Session ${fmtDate(view.session.date)}`}
          onClose={() => setView(null)}
          actions={
            <>
              {view.session.state === 'ARCHIVED' ? (
                <button className="ghost" onClick={() => setEdit(v=>!v)}>{edit ? 'Stop editing' : 'Edit past session'}</button>
              ) : null}
              {edit ? (
                <button className="primary" onClick={async () => {
                  await saveEditedSession(view.session.id);
                  await refresh();
                  setView(null);
                }}>Save</button>
              ) : null}
              <button className="ghost" onClick={() => setView(null)}>Close</button>
            </>
          }
        >
          <SessionDetail view={view} editable={edit} onChange={async () => {
            const ex = await db.sessionExercises.where('sessionId').equals(view.session.id).sortBy('order');
            const sets = await db.sets.where('sessionId').equals(view.session.id).toArray();
            setView({ ...view, ex, sets });
          }} />
        </Modal>
      ) : null}
    </>
  );
}

function AddBodyweight({ onAdded }:{ onAdded: ()=>void }) {
  const [date, setDate] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'KG'|'LB'>('KG');
  return (
    <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', gap: 10 }}>
      <div>
        <label>Date (YYYY-MM-DD)</label>
        <input value={date} onChange={(e)=>setDate(e.target.value)} placeholder="2026-02-24" />
      </div>
      <div>
        <label>Weight</label>
        <input inputMode="decimal" value={weight} onChange={(e)=>setWeight(e.target.value)} />
      </div>
      <div>
        <label>Unit</label>
        <select value={unit} onChange={(e)=>setUnit(e.target.value as any)}>
          <option value="KG">KG</option>
          <option value="LB">LB</option>
        </select>
      </div>
      <div className="row" style={{ justifyContent:'flex-end' }}>
        <button className="primary" onClick={async () => {
          const w = Number(weight);
          if (!date || !Number.isFinite(w)) return;
          const now = Date.now();
          // unique per date: upsert
          const existing = await db.bodyweights.get({ date } as any).catch(()=>null);
          if (existing) {
            await db.bodyweights.put({ ...existing, weight: w, unit, updatedAt: now });
          } else {
            await db.bodyweights.put({ id: crypto.randomUUID().replace(/-/g,'').slice(0,26).toUpperCase(), date, weight: w, unit, createdAt: now, updatedAt: now });
          }
          setDate(''); setWeight('');
          onAdded();
        }}>Add</button>
      </div>
    </div>
  );
}

function SessionDetail({ view, editable, onChange }:{ view: any; editable: boolean; onChange: ()=>void }) {
  const bySE = new Map<string, any[]>(view.sets.reduce((acc:any[], s:any) => {
    const arr = (acc as any);
    return acc;
  }, []));
  return (
    <div>
      <div className="muted">State: {view.session.state}</div>
      <div className="hr" />
      {view.ex.map((se:any) => {
        const sets = view.sets.filter((s:any)=>s.sessionExerciseId===se.id).sort((a:any,b:any)=>a.order-b.order);
        return (
          <div key={se.id} className="card" style={{ boxShadow:'none', marginBottom: 10 }}>
            <div className="h2">{se.exerciseId}</div>
            {sets.length ? sets.map((s:any, i:number) => (
              <div key={s.id} className="row between" style={{ padding:'6px 0' }}>
                <div className="muted" style={{ fontSize: 12 }}>#{i+1} {s.setType} • reps {s.reps ?? '—'} • load {s.load ?? '—'} • RIR {s.rir ?? '—'}</div>
                {editable ? (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="ghost" style={{ minHeight: 34 }} onClick={async () => {
                      const reps = prompt('Reps', String(s.reps ?? '')) ?? '';
                      const load = prompt('Load', String(s.load ?? '')) ?? '';
                      const rir = prompt('RIR', String(s.rir ?? '')) ?? '';
                      const setType = prompt('Set type (WARMUP|WORKING|CARDIO|OTHER)', String(s.setType ?? 'WORKING')) ?? 'WORKING';
                      await updateSet(s.id, {
                        reps: reps===''?undefined:Number(reps),
                        load: load===''?undefined:Number(load),
                        rir: rir===''?undefined:Number(rir),
                        setType: setType as any,
                      });
                      onChange();
                    }}>Edit</button>
                    <button className="ghost" style={{ minHeight: 34 }} onClick={async () => {
                      if (!confirm('Delete set?')) return;
                      await deleteSet(s.id);
                      onChange();
                    }}>Del</button>
                  </div>
                ) : null}
              </div>
            )) : <div className="muted">No sets.</div>}
          </div>
        );
      })}
    </div>
  );
}
