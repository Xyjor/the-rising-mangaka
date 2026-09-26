import { afterEach, describe, expect, it, vi } from 'vitest'
import { documentDir, join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { exportSave, importSave } from '../saveTransfer.desktop'

// Tauri's dialogs, file access and paths, replaced: the dialogs answer what each test sets.
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: vi.fn(), writeTextFile: vi.fn(async () => {}) }))
vi.mock('@tauri-apps/api/path', () => ({
  documentDir: vi.fn(async () => 'C:\\Users\\Rin\\Documents'),
  join: vi.fn(async (...parts: string[]) => parts.join('\\')),
}))

const FILTERS = [{ name: 'Rising Mangaka save', extensions: ['json'] }]

afterEach(() => {
  vi.clearAllMocks()
})

describe('exportSave (desktop)', () => {
  it('asks where to save, starting in Documents with the file name, and writes the text there', async () => {
    vi.mocked(save).mockResolvedValue('D:\\Backups\\my-career.json')
    await expect(exportSave('rising-mangaka-rin-month-1.json', '{"a":1}')).resolves.toBe('saved')
    expect(save).toHaveBeenCalledWith({
      title: 'Export save file',
      defaultPath: 'C:\\Users\\Rin\\Documents\\rising-mangaka-rin-month-1.json',
      filters: FILTERS,
    })
    expect(join).toHaveBeenCalledWith('C:\\Users\\Rin\\Documents', 'rising-mangaka-rin-month-1.json')
    expect(writeTextFile).toHaveBeenCalledWith('D:\\Backups\\my-career.json', '{"a":1}')
  })

  it('writes nothing when the player cancels the dialog', async () => {
    vi.mocked(save).mockResolvedValue(null)
    await expect(exportSave('rising-mangaka-rin-month-1.json', '{"a":1}')).resolves.toBe('cancelled')
    expect(writeTextFile).not.toHaveBeenCalled()
  })

  it('offers the bare file name when there is no Documents folder', async () => {
    vi.mocked(documentDir).mockRejectedValueOnce(new Error('unknown path'))
    vi.mocked(save).mockResolvedValue(null)
    await exportSave('rising-mangaka-rin-month-1.json', '{"a":1}')
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'rising-mangaka-rin-month-1.json' }))
  })

  it('rejects when the file cannot be written', async () => {
    vi.mocked(save).mockResolvedValue('Z:\\read-only\\save.json')
    vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('access denied'))
    await expect(exportSave('rising-mangaka-rin-month-1.json', '{"a":1}')).rejects.toThrow('access denied')
  })
})

describe('importSave (desktop)', () => {
  it('asks for one JSON file and reads it as text', async () => {
    vi.mocked(open).mockResolvedValue('D:\\Backups\\my-career.json')
    vi.mocked(readTextFile).mockResolvedValue('{"format":"rising-mangaka-save"}')
    await expect(importSave()).resolves.toBe('{"format":"rising-mangaka-save"}')
    expect(open).toHaveBeenCalledWith({ title: 'Load save file', multiple: false, directory: false, filters: FILTERS })
    expect(readTextFile).toHaveBeenCalledWith('D:\\Backups\\my-career.json')
  })

  it('resolves null when the player cancels the dialog', async () => {
    vi.mocked(open).mockResolvedValue(null)
    await expect(importSave()).resolves.toBeNull()
    expect(readTextFile).not.toHaveBeenCalled()
  })

  it('rejects when the file cannot be read', async () => {
    vi.mocked(open).mockResolvedValue('D:\\Backups\\gone.json')
    vi.mocked(readTextFile).mockRejectedValueOnce(new Error('not found'))
    await expect(importSave()).rejects.toThrow('not found')
  })
})
