export function fmtDuration(sec?: number): string {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
export function fmtDate(ymd: string): string {
  const [y,m,d] = ymd.split('-').map(Number);
  const dt = new Date(y, (m??1)-1, d??1);
  return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' }).format(dt);
}
