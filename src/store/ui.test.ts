import { LINGER_MS } from './ui'

const KEY = 'godo.collapsed'

/** 모듈이 처음 읽힐 때 localStorage 를 읽으므로, 값을 심은 뒤 새로 불러온다. */
async function freshUI(stored: string | null) {
  vi.resetModules()
  if (stored === null) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, stored)
  return (await import('./ui')).useUI
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('collapsed state loaded from localStorage', () => {
  test.each([
    ['null', 'null'],
    ['an array', '["a","b"]'],
    ['a string', '"collapsed"'],
    ['a number', '42'],
    ['broken JSON', '{not json'],
    ['nothing stored', null],
  ])('starts with nothing collapsed when the stored value is %s', async (_name, stored) => {
    const useUI = await freshUI(stored)

    expect(useUI.getState().collapsed).toEqual({})
    expect(useUI.getState().collapsed['any-task']).toBeUndefined()
    useUI.getState().toggleCollapsed('any-task')
    expect(useUI.getState().collapsed).toEqual({ 'any-task': true })
  })

  test('keeps only ids that are flagged true and never pollutes the prototype', async () => {
    const useUI = await freshUI('{"a":true,"b":false,"c":"yes","__proto__":{"polluted":true}}')

    const { collapsed } = useUI.getState()
    expect(collapsed).toEqual({ a: true })
    expect(Object.getPrototypeOf(collapsed)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  test('drops a literal __proto__ id even when flagged true', async () => {
    const useUI = await freshUI('{"__proto__":true,"ok":true}')

    expect(useUI.getState().collapsed).toEqual({ ok: true })
  })

  test('survives localStorage that throws on read', async () => {
    vi.resetModules()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    const { useUI } = await import('./ui')

    expect(useUI.getState().collapsed).toEqual({})
  })

  test('toggling saves to localStorage and the next start restores it', async () => {
    const first = await freshUI(null)

    first.getState().toggleCollapsed('x')
    first.getState().toggleCollapsed('y')
    first.getState().toggleCollapsed('x')

    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ y: true })
    const second = await freshUI(localStorage.getItem(KEY))
    expect(second.getState().collapsed).toEqual({ y: true })
  })

  test('keeps working in memory when saving is blocked', async () => {
    const useUI = await freshUI(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    useUI.getState().toggleCollapsed('x')

    expect(useUI.getState().collapsed).toEqual({ x: true })
  })
})

describe('screen state', () => {
  test('selects, toggles and clears tasks and remembers the focused one', async () => {
    const useUI = await freshUI(null)
    const ui = () => useUI.getState()

    ui().selectRange(['a', 'b', 'c'])
    ui().toggleSelected('b')
    ui().toggleSelected('d')
    expect(ui().selectedIds).toEqual(['a', 'c', 'd'])

    ui().setFocused('c')
    expect(ui().focusedId).toBe('c')

    ui().clearSelection()
    expect(ui().selectedIds).toEqual([])
  })

  test('opens and closes quick add, the entity dialog, the palette, help and the sidebar', async () => {
    const useUI = await freshUI(null)
    const ui = () => useUI.getState()

    ui().openQuickAdd({ projectId: 'p', text: '메모' })
    expect(ui().quickAdd).toEqual({ open: true, defaults: { projectId: 'p', text: '메모' } })
    ui().closeQuickAdd()
    expect(ui().quickAdd).toEqual({ open: false, defaults: {} })

    ui().openEntityDialog({ kind: 'label', id: 'l' })
    expect(ui().entityDialog).toEqual({ kind: 'label', id: 'l' })
    ui().closeEntityDialog()
    expect(ui().entityDialog).toBeNull()

    ui().setPalette(true)
    ui().setHelp(true)
    ui().setSidebarOpen(true)
    expect([ui().paletteOpen, ui().helpOpen, ui().sidebarOpen]).toEqual([true, true, true])
  })

  test('a completed row lingers for LINGER_MS and then disappears', async () => {
    const useUI = await freshUI(null)
    vi.useFakeTimers()

    useUI.getState().markLingering('t1')
    expect(useUI.getState().lingering).toEqual({ t1: true })

    vi.advanceTimersByTime(LINGER_MS - 1)
    expect(useUI.getState().lingering).toEqual({ t1: true })
    vi.advanceTimersByTime(1)
    expect(useUI.getState().lingering).toEqual({})
  })
})
