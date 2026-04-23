import { randomBytes } from 'node:crypto'

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function encodeTime(now: number, len: number): string {
  let out = ''
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32
    out = ENCODING[mod]! + out
    now = (now - mod) / 32
  }
  return out
}

function encodeRandom(len: number): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ENCODING[bytes[i]! % 32]
  return out
}

export function ulid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16)
}
