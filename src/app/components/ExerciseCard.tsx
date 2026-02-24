import { useState } from 'react'
import type { Prescription } from '../../domain/models/types'

export default function ExerciseCard({
  name,
  prescription,
  lastWeekSnippet,
}:{
  name: string;
  prescription?: Prescription;
  lastWeekSnippet?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: 12 }}>
      <button className="ghost" style={{ width:'100%', textAlign:'left', border:'none' }} onClick={() => setOpen(v=>!v)} aria-expanded={open}>
        <div className="row between">
          <div style={{ fontWeight: 700 }}>{name}</div>
          <span className="muted">{open ? '▲' : '▼'}</span>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {prescription?.targetSets ? `${prescription.targetSets} sets` : '—'} • {prescription?.targetReps ?? 'reps'} • {prescription?.restSec ? `${prescription.restSec}s rest` : 'rest'}
        </div>
      </button>
      {open ? (
        <div style={{ marginTop: 10 }}>
          {prescription?.notes ? <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{prescription.notes}</div> : null}
          {lastWeekSnippet ? <div className="chip">🕒 Last week: {lastWeekSnippet}</div> : <div className="muted" style={{ fontSize: 12 }}>No previous week data.</div>}
        </div>
      ) : null}
    </div>
  );
}
