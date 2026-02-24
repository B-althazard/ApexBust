const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' as const;

function randomChar(): string {
  const idx = Math.floor(Math.random() * ENCODING.length);
  return ENCODING[idx]!;
}

function encodeTime(timeMs: number): string {
  // Crockford base32, 10 chars for 48-bit timestamp.
  let t = timeMs;
  let out = '';
  for (let i = 0; i < 10; i++) {
    out = ENCODING[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

export function ulid(nowMs: number = Date.now()): string {
  let id = encodeTime(nowMs);
  for (let i = 0; i < 16; i++) id += randomChar();
  return id;
}
