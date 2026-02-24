import { monthGrid, formatWeekdayShort, weekdayIndex } from '../../utils/date'
import { fmtDate } from '../../utils/format'

export type DayBadge = 'WORKOUT'|'REST'|'COMPLETED'|'SKIPPED'|null;

export default function CalendarMonth({
  year, monthIndex0, badges, selected, onSelect
}:{
  year: number;
  monthIndex0: number;
  badges: Record<string, DayBadge>;
  selected: string;
  onSelect: (ymd: string) => void;
}) {
  const grid = monthGrid(year, monthIndex0);
  const weekdays = Array.from({length:7}, (_,i)=>formatWeekdayShort(i));
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="h2">{new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric' }).format(new Date(year, monthIndex0, 1))}</div>
        <div className="muted" style={{ fontSize: 12 }}>{fmtDate(selected)}</div>
      </div>
      <div className="hr" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap: 6 }}>
        {weekdays.map(w => <div key={w} className="muted" style={{ fontSize: 11, textAlign:'center' }}>{w}</div>)}
        {grid.map(({ymd, inMonth}) => {
          const badge = badges[ymd] ?? null;
          const isSel = ymd === selected;
          return (
            <button
              key={ymd}
              className="ghost"
              style={{
                minHeight: 44,
                borderRadius: 12,
                borderColor: isSel ? 'color-mix(in srgb, var(--primary) 55%, var(--border))' : 'transparent',
                background: isSel ? 'color-mix(in srgb, var(--primary) 14%, var(--surface))' : 'transparent',
                opacity: inMonth ? 1 : 0.45,
                padding: 6,
              }}
              onClick={() => onSelect(ymd)}
              aria-label={fmtDate(ymd)}
            >
              <div style={{ fontSize: 13, fontWeight: 650, textAlign:'center' }}>
                {Number(ymd.slice(-2))}
              </div>
              <div style={{ display:'flex', justifyContent:'center', marginTop: 2 }}>
                {badge ? <span className={'badge ' + badgeClass(badge)}>{badgeLabel(badge)}</span> : <span style={{ height: 18 }} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function badgeLabel(b: DayBadge): string {
  switch (b) {
    case 'WORKOUT': return 'W';
    case 'REST': return 'R';
    case 'COMPLETED': return '✓';
    case 'SKIPPED': return '—';
    default: return '';
  }
}
function badgeClass(b: DayBadge): string {
  switch (b) {
    case 'COMPLETED': return 'ok';
    case 'SKIPPED': return 'danger';
    case 'WORKOUT': return 'warn';
    case 'REST': return '';
    default: return '';
  }
}
