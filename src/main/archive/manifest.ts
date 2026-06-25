import { z } from 'zod'

export const ARCHIVE_VERSION = 2

export const ManifestAssetSchema = z.object({
  name: z.string(),
  path: z.string()
})

export const ManifestCardSchema = z.object({
  path: z.string(),
  assets: z.array(ManifestAssetSchema).default([])
})

export const ManifestSchema = z.object({
  version: z.number().int().positive(),
  exportedAt: z.string().datetime(),
  cardCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([]),
  cards: z.array(ManifestCardSchema).optional()
})

export type Manifest = z.infer<typeof ManifestSchema>
export type ManifestCard = z.infer<typeof ManifestCardSchema>

export function assertSupportedVersion(version: number): void {
  if (version > ARCHIVE_VERSION) {
    throw new Error(
      `Archive version ${version} is newer than this app supports (max ${ARCHIVE_VERSION}). Please update the app.`
    )
  }
}
