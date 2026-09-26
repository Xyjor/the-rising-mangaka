// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock, MockInstance } from 'vitest'
import '../../test/dom'
import * as desktop from '../saveTransfer.desktop'
import { MAX_READ_BYTES, exportSave, importSave } from '../saveTransfer'

// The desktop transfer is replaced, so a test can tell whether the browser path or the desktop one ran.
vi.mock('../saveTransfer.desktop', () => ({
  exportSave: vi.fn(async () => 'saved'),
  importSave: vi.fn(async () => 'from the desktop'),
}))

const g = globalThis as { isTauri?: unknown }

afterEach(() => {
  delete g.isTauri
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('exportSave in a browser', () => {
  let clicked: HTMLAnchorElement[]
  let blobs: Blob[]
  let revoke: Mock<(url: string) => void>

  beforeEach(() => {
    vi.useFakeTimers()
    clicked = []
    blobs = []
    revoke = vi.fn<(url: string) => void>()
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob)
      return 'blob:the-save'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })
  })

  it('downloads the text as a JSON file under the given name, then lets the URL go after a second', async () => {
    await expect(exportSave('rising-mangaka-rin-month-1.json', '{"format":"rising-mangaka-save"}')).resolves.toBe('saved')

    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('rising-mangaka-rin-month-1.json')
    expect(clicked[0].getAttribute('href')).toBe('blob:the-save')
    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toBe('application/json')
    expect(await blobs[0].text()).toBe('{"format":"rising-mangaka-save"}')
    // The temporary link does not stay in the page.
    expect(document.querySelector('a[download]')).toBeNull()

    vi.advanceTimersByTime(999)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(revoke).toHaveBeenCalledWith('blob:the-save')
    expect(desktop.exportSave).not.toHaveBeenCalled()
  })
})

describe('importSave in a browser', () => {
  let click: MockInstance<HTMLInputElement['click']>

  beforeEach(() => {
    click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
  })

  /** The file input the last importSave clicked. */
  const picker = (): HTMLInputElement => click.mock.contexts.at(-1) as HTMLInputElement

  /** The player picks `files` in the file picker. */
  function pick(files: File[]) {
    Object.defineProperty(picker(), 'files', { configurable: true, value: files })
    picker().dispatchEvent(new Event('change'))
  }

  it('opens a picker for JSON files and resolves the picked file as text', async () => {
    const result = importSave()
    expect(click).toHaveBeenCalledTimes(1)
    expect(picker().type).toBe('file')
    expect(picker().accept).toBe('.json,application/json')
    pick([new File(['{"format":"rising-mangaka-save"}'], 'save.json', { type: 'application/json' })])
    await expect(result).resolves.toBe('{"format":"rising-mangaka-save"}')
    expect(desktop.importSave).not.toHaveBeenCalled()
  })

  it('reads at most 15,000,003 bytes: enough for any save, and more than 5,000,000 characters of any larger file', async () => {
    expect(MAX_READ_BYTES).toBe(15_000_003)
    const small = new File(['{"format":"rising-mangaka-save"}'], 'save.json')
    const slice = vi.spyOn(small, 'slice')
    const result = importSave()
    pick([small])
    await expect(result).resolves.toBe('{"format":"rising-mangaka-save"}')
    expect(slice).toHaveBeenCalledWith(0, 15_000_003)
  })

  it('never reads a huge file whole, only its head', async () => {
    // A two-gigabyte file stand-in: only the slice is readable, so reading the whole file would reject.
    const head = new Blob(['the first bytes'])
    const huge = {
      name: 'video.json', size: 2_000_000_000,
      slice: vi.fn(() => head),
      text: vi.fn(async () => { throw new Error('read the whole file') }),
    } as unknown as File
    const result = importSave()
    pick([huge])
    await expect(result).resolves.toBe('the first bytes')
    expect(huge.slice).toHaveBeenCalledWith(0, 15_000_003)
    expect(huge.text).not.toHaveBeenCalled()
  })

  it('resolves null when the player cancels the picker', async () => {
    const result = importSave()
    picker().dispatchEvent(new Event('cancel'))
    await expect(result).resolves.toBeNull()
  })

  it('resolves null when the picker reports a change with no file', async () => {
    const result = importSave()
    pick([])
    await expect(result).resolves.toBeNull()
  })

  it('rejects when the picked file cannot be read', async () => {
    const result = importSave()
    const unreadable = new Blob(['x'])
    vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('NotReadableError'))
    const broken = new File(['x'], 'save.json')
    vi.spyOn(broken, 'slice').mockReturnValue(unreadable)
    pick([broken])
    await expect(result).rejects.toThrow('NotReadableError')
  })
})

describe('in the desktop app', () => {
  it('hands export and import to the desktop transfer', async () => {
    g.isTauri = true
    const click = vi.spyOn(HTMLElement.prototype, 'click')
    await expect(exportSave('rising-mangaka-rin-month-1.json', 'text')).resolves.toBe('saved')
    expect(desktop.exportSave).toHaveBeenCalledWith('rising-mangaka-rin-month-1.json', 'text')
    await expect(importSave()).resolves.toBe('from the desktop')
    expect(desktop.importSave).toHaveBeenCalledTimes(1)
    expect(click).not.toHaveBeenCalled()
  })
})
