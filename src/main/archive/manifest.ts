import { z } from 'zod'

export const ARCHIVE_VERSION = 1

export const ManifestSchema = z.object({
  version: z.number().int().positive(),
  exportedAt: z.string().datetime(),
  cardCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([])
})

export type Manifest = z.infer<typeof ManifestSchema>

export function assertSupportedVersion(version: number): void {
  if (version > ARCHIVE_VERSION) {
    throw new Error(
      `Archive version ${version} is newer than this app supports (max ${ARCHIVE_VERSION}). Please update the app.`
    )
  }
}
