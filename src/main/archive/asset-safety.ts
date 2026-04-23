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
