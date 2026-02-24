import type { SetType } from '../../domain/models/types'

export default function SetRow({
  idx, setType, reps, load, rir, createdAt,
  editable,
  onEdit,
  onDelete
}:{
  idx: number;
  setType: SetType;
  reps?: number;
  load?: number;
  rir?: number;
  createdAt: number;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = new Date(createdAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  return (
    <div className="row between" style={{ padding: '8px 0' }}>
      <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
        <span className="badge">{idx}</span>
        <span className="muted" style={{ width: 62 }}>{setType}</span>
        <span>{reps ?? '—'} reps</span>
        <span className="muted">•</span>
        <span>{load ?? '—'} load</span>
        <span className="muted">•</span>
        <span>RIR {rir ?? '—'}</span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>{t}</span>
        {editable ? (
          <>
            <button className="ghost" style={{ minHeight: 34, padding: '6px 10px' }} onClick={onEdit}>Edit</button>
            <button className="ghost" style={{ minHeight: 34, padding: '6px 10px' }} onClick={onDelete}>Del</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
