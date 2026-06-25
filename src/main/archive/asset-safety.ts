/**
 * Validates an asset filename captured from a card body against path-traversal
 * attacks. Returns true when the name is safe to use in a filesystem operation,
 * false otherwise.
 *
 * Rejected names:
 *  - contain a forward- or back-slash (path separator)
 *  - contain a null byte
 *  - start with a dot (hidden files, and covers the ".." case explicitly)
 */
export function isSafeAssetName(name: string): boolean {
  if (name.includes('/') || name.includes('\\')) return false
  if (name.includes('\0')) return false
  if (name.startsWith('.')) return false
  return true
}

export function isSafeArchiveAssetPath(archivePath: string): boolean {
  if (archivePath.includes('\\') || archivePath.includes('\0')) return false
  const parts = archivePath.split('/')
  if (parts.length !== 3) return false
  const [root, scope, filename] = parts
  if (root !== 'assets') return false
  if (!scope || scope === '.' || scope === '..' || scope.startsWith('.')) return false
  return typeof filename === 'string' && isSafeAssetName(filename)
}
