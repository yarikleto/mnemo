import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { configPath, defaultRootPath } from '../../src/main/paths'

describe('paths', () => {
  it('uses the Electron userData directory for the default vault', () => {
    expect(defaultRootPath('/tmp/Mnemo')).toBe(path.join('/tmp/Mnemo', 'vault'))
    expect(configPath('/tmp/Mnemo')).toBe(path.join('/tmp/Mnemo', 'config.json'))
  })
})
