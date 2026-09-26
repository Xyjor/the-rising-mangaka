// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import { isBrowserShortcut, isEditableTarget } from '../keys'
import type { KeyCombo } from '../keys'

/** A key press: `key` as KeyboardEvent.key names it, plus the modifiers held (none by default). */
function press(key: string, mods: Partial<Omit<KeyCombo, 'key'>> = {}): KeyCombo {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods }
}

describe('isBrowserShortcut', () => {
  it.each([
    ['F5', press('F5')],
    ['Ctrl+R', press('r', { ctrlKey: true })],
    ['Ctrl+Shift+R', press('R', { ctrlKey: true, shiftKey: true })],
    ['Ctrl+P', press('p', { ctrlKey: true })],
    ['Alt+ArrowLeft', press('ArrowLeft', { altKey: true })],
    ['Alt+ArrowRight', press('ArrowRight', { altKey: true })],
    ['Ctrl+F5', press('F5', { ctrlKey: true })],
    ['Shift+F5', press('F5', { shiftKey: true })],
    ['Ctrl+Shift+P', press('P', { ctrlKey: true, shiftKey: true })],
    ['Ctrl+S', press('s', { ctrlKey: true })],
    ['Ctrl+U', press('u', { ctrlKey: true })],
    ['Ctrl+F', press('f', { ctrlKey: true })],
    ['Ctrl+G', press('g', { ctrlKey: true })],
    ['F3', press('F3')],
    ['F7', press('F7')],
    ['Cmd+R', press('r', { metaKey: true })],
    ['BrowserBack', press('BrowserBack')],
    ['BrowserForward', press('BrowserForward')],
    ['BrowserRefresh', press('BrowserRefresh')],
  ])('is true for %s', (_name, combo) => {
    expect(isBrowserShortcut(combo)).toBe(true)
  })

  it.each([
    ['Ctrl+C', press('c', { ctrlKey: true })],
    ['Ctrl+V', press('v', { ctrlKey: true })],
    ['Ctrl+A', press('a', { ctrlKey: true })],
    ['Ctrl+X', press('x', { ctrlKey: true })],
    ['Ctrl+Z', press('z', { ctrlKey: true })],
    ['r', press('r')],
    ['p', press('p')],
    ['space', press(' ')],
    ['F11', press('F11')],
    ['Escape', press('Escape')],
    ['ArrowLeft', press('ArrowLeft')],
    ['Alt+R', press('r', { altKey: true })],
    // Zoom stays on in the desktop app (accessibility).
    ['Ctrl+=', press('=', { ctrlKey: true })],
    ['Ctrl+-', press('-', { ctrlKey: true })],
    ['Ctrl+0', press('0', { ctrlKey: true })],
  ])('is false for %s', (_name, combo) => {
    expect(isBrowserShortcut(combo)).toBe(false)
  })
})

describe('isEditableTarget', () => {
  function el(html: string): Element {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    return host.firstElementChild!
  }

  it.each([
    ['a text input', '<input>'],
    ['a search input', '<input type="search">'],
    ['a number input', '<input type="number">'],
    ['an email input', '<input type="email">'],
    ['a password input', '<input type="password">'],
    ['a textarea', '<textarea></textarea>'],
    ['a contenteditable element', '<div contenteditable="true"></div>'],
  ])('is true for %s', (_name, html) => {
    expect(isEditableTarget(el(html))).toBe(true)
  })

  it('is true for an element inside a contenteditable one', () => {
    expect(isEditableTarget(el('<div contenteditable="true"><b>bold</b></div>').firstElementChild)).toBe(true)
  })

  it.each([
    ['a range input', '<input type="range">'],
    ['a checkbox', '<input type="checkbox">'],
    ['an input button', '<input type="button">'],
    ['a button', '<button>Go</button>'],
    ['a select', '<select><option>A</option></select>'],
    ['a div', '<div>text</div>'],
    ['a canvas', '<canvas></canvas>'],
  ])('is false for %s', (_name, html) => {
    expect(isEditableTarget(el(html))).toBe(false)
  })

  it('is false for no target, the document and the window', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget(document)).toBe(false)
    expect(isEditableTarget(window)).toBe(false)
  })
})
