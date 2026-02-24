export const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const;
export const WEEKDAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;

export function weekdayName(i: number, short = false): string {
  const idx = ((i % 7) + 7) % 7;
  return (short ? WEEKDAY_SHORT[idx] : WEEKDAY_NAMES[idx]) ?? String(i);
}
