// Resolve an <img src> from markdown against the card's absolute file path,
// turning relative paths into mnemo-asset:// URLs so Electron can serve them.
export function resolveAssetUrl(src: string, cardAbsPath: string | undefined): string {
  if (!src) return src
  if (/^(https?:|data:|blob:|mnemo-asset:)/i.test(src)) return src
  if (!cardAbsPath) return src
  const dirEnd = Math.max(cardAbsPath.lastIndexOf('/'), cardAbsPath.lastIndexOf('\\'))
  const cardDir = dirEnd >= 0 ? cardAbsPath.slice(0, dirEnd) : cardAbsPath
  const sep = cardAbsPath.includes('\\') && !cardAbsPath.includes('/') ? '\\' : '/'
  const joined = normalize(`${cardDir}${sep}${src}`, sep)
  return `mnemo-asset://host/${encodeURI(joined.replace(/\\/g, '/'))}`
}

function normalize(p: string, sep: string): string {
  const parts = p.split(/[\\/]+/)
  const out: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') { if (out.length === 0 && part === '') out.push('') ; continue }
    if (part === '..') { if (out.length > 1) out.pop() ; continue }
    out.push(part)
  }
  return out.join(sep)
}
