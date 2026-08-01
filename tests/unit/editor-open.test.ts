import { describe, it, expect, vi, beforeEach } from 'vitest'

const shellMock = vi.hoisted(() => ({ openPath: vi.fn(async () => '') }))

vi.mock('electron', () => ({ shell: shellMock }))

import { openInExternalEditor } from '../../src/main/editor-open'

describe('openInExternalEditor', () => {
  beforeEach(() => { shellMock.openPath.mockClear().mockResolvedValue('') })

  // Regression: spawn() reports a missing binary asynchronously via an 'error'
  // event. With no listener that event is re-thrown as an uncaught exception,
  // so a typo in the External editor setting crashed the whole main process.
  it('rejects with a readable message when the editor binary is missing', async () => {
    await expect(
      openInExternalEditor('/tmp/card.md', 'mnemo-not-a-real-editor-xyz')
    ).rejects.toThrow(/was not found on your PATH/)
  })

  it('resolves once a real binary has spawned', async () => {
    await expect(openInExternalEditor('/tmp/card.md', 'true')).resolves.toBeUndefined()
    expect(shellMock.openPath).not.toHaveBeenCalled()
  })

  it('falls back to the system opener with no override', async () => {
    await expect(openInExternalEditor('/tmp/card.md', null)).resolves.toBeUndefined()
    expect(shellMock.openPath).toHaveBeenCalledWith('/tmp/card.md')
  })

  it('surfaces a system-opener failure instead of silently succeeding', async () => {
    shellMock.openPath.mockResolvedValue('no application knows how to open this file')
    await expect(openInExternalEditor('/tmp/card.md', null)).rejects.toThrow(/Could not open card file/)
  })
})
