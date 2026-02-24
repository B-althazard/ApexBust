import { useEffect, useMemo, useState } from 'react'

export default function TimerChip({ startedAt, durationSec, onClear }:{
  startedAt?: number;
  durationSec: number;
  onClear: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const remaining = useMemo(() => {
    if (!startedAt) return null;
    const elapsed = Math.floor((now - startedAt) / 1000);
    return Math.max(0, durationSec - elapsed);
  }, [now, startedAt, durationSec]);

  if (!startedAt) return null;
  return (
    <span className="chip">
      ⏱️ {remaining}s
      <button className="ghost" style={{ minHeight: 28, padding: '4px 8px' }} onClick={onClear}>Clear</button>
    </span>
  );
}
