export type YMD = string; // YYYY-MM-DD

export function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

export function toYMD(d: Date): YMD {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

export function fromYMD(ymd: YMD): Date {
  // local time
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(ymd: YMD, days: number): YMD {
  const d = fromYMD(ymd);
  d.setDate(d.getDate() + days);
  return toYMD(d);
}

// JS getDay(): 0=Sunday..6=Saturday matches our internal decision.
export function weekdayIndex(ymd: YMD): number {
  return fromYMD(ymd).getDay();
}

export function startOfAnchoredWeek(date: YMD, anchorWeekday: number): YMD {
  const wd = weekdayIndex(date);
  const diff = (wd - anchorWeekday + 7) % 7;
  return addDays(date, -diff);
}

export function isSameYMD(a: YMD, b: YMD): boolean { return a === b; }

export function formatWeekdayShort(idx: number): string {
  // Localized with Intl
  const base = new Date(2023, 0, 1); // Sunday
  base.setDate(base.getDate() + idx);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(base);
}

export function monthGrid(year: number, monthIndex0: number): { ymd: YMD; inMonth: boolean; }[] {
  // monthIndex0: 0..11
  const first = new Date(year, monthIndex0, 1);
  const last = new Date(year, monthIndex0 + 1, 0);
  const start = new Date(first);
  // grid starts Sunday
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));
  const out: { ymd: YMD; inMonth: boolean; }[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push({ ymd: toYMD(d), inMonth: d.getMonth() === monthIndex0 });
  }
  return out;
}

export function formatDisplayDate(ymd: string): string {
  // YYYY-MM-DD -> DD-MM-YYYY
  const [y,m,d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
}
