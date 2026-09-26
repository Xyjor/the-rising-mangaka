import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportSave } from '../../platform/saveTransfer'
import { exportNotice } from '../useSaveFile'

// The file dialog is replaced: each test says how the export went.
vi.mock('../../platform/saveTransfer', () => ({ exportSave: vi.fn(), importSave: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
})

describe('exportNotice (Settings and the recovery screen)', () => {
  it('exports the text under the file name and says so', async () => {
    vi.mocked(exportSave).mockResolvedValue('saved')
    await expect(exportNotice('rising-mangaka-rin-month-1.json', '{"a":1}')).resolves.toEqual({
      kind: 'done', text: 'Exported rising-mangaka-rin-month-1.json.',
    })
    expect(exportSave).toHaveBeenCalledWith('rising-mangaka-rin-month-1.json', '{"a":1}')
  })

  it('says nothing when the player cancels', async () => {
    vi.mocked(exportSave).mockResolvedValue('cancelled')
    await expect(exportNotice('rising-mangaka-rin-month-1.json', '{"a":1}')).resolves.toBeNull()
  })

  it('says what to do when the file cannot be written', async () => {
    vi.mocked(exportSave).mockRejectedValue(new Error('access denied'))
    await expect(exportNotice('rising-mangaka-rin-month-1.json', '{"a":1}')).resolves.toEqual({
      kind: 'error', text: 'Could not write the file. Pick another folder and try again.',
    })
  })
})
