// 저장하지 않는 화면 상태(선택, 포커스, 열린 대화상자). 접힘 상태만 localStorage에 남긴다.
import { create } from 'zustand'
import type { ID } from '../domain/types'

const COLLAPSED_KEY = 'godo.collapsed'

function loadCollapsed(): Record<ID, true> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    // 손상되었거나 직접 고친 값(null, 배열, 문자열 등)이면 무시한다. 그대로 쓰면 접힘 확인에서 앱이 멈춘다.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const clean: Record<ID, true> = Object.create(null)
    for (const [id, flag] of Object.entries(parsed)) if (flag === true && id !== '__proto__') clean[id] = true
    return { ...clean }
  } catch {
    return {}
  }
}

function saveCollapsed(value: Record<ID, true>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value))
  } catch {
    // 저장 공간이 막힌 환경에서는 이번 세션 동안만 유지한다.
  }
}

export interface QuickAddDefaults {
  projectId?: ID
  sectionId?: ID | null
  parentId?: ID | null
  startDate?: string | null
  startTime?: string | null
  /** 입력창에 미리 채워 둘 문장 */
  text?: string
}

export interface EntityDialogTarget {
  kind: 'project' | 'label' | 'filter'
  id?: ID
  parentId?: ID | null
  /** 필터 대화상자를 열 때 미리 채울 조건 */
  query?: string
}

/** 방금 완료한 행을 목록에 남겨 두는 시간 */
export const LINGER_MS = 4000

interface UIState {
  /** 방금 완료해서 잠깐 목록에 남겨 둘 할 일 id */
  lingering: Readonly<Record<ID, true>>
  markLingering: (id: ID) => void
  entityDialog: EntityDialogTarget | null
  openEntityDialog: (target: EntityDialogTarget) => void
  closeEntityDialog: () => void
  selectedIds: readonly ID[]
  focusedId: ID | null
  collapsed: Readonly<Record<ID, true>>
  quickAdd: { open: boolean; defaults: QuickAddDefaults }
  paletteOpen: boolean
  helpOpen: boolean
  sidebarOpen: boolean
  toggleSelected: (id: ID) => void
  selectRange: (ids: readonly ID[]) => void
  clearSelection: () => void
  setFocused: (id: ID | null) => void
  toggleCollapsed: (id: ID) => void
  openQuickAdd: (defaults?: QuickAddDefaults) => void
  closeQuickAdd: () => void
  setPalette: (open: boolean) => void
  setHelp: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
}

export const useUI = create<UIState>((set, get) => ({
  lingering: {},
  markLingering: (id) => {
    set((s) => ({ lingering: { ...s.lingering, [id]: true } }))
    setTimeout(() => {
      set((s) => {
        const next = { ...s.lingering }
        delete next[id]
        return { lingering: next }
      })
    }, LINGER_MS)
  },
  entityDialog: null,
  openEntityDialog: (target) => set({ entityDialog: target }),
  closeEntityDialog: () => set({ entityDialog: null }),
  selectedIds: [],
  focusedId: null,
  collapsed: loadCollapsed(),
  quickAdd: { open: false, defaults: {} },
  paletteOpen: false,
  helpOpen: false,
  sidebarOpen: false,

  toggleSelected: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
    })),
  selectRange: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
  setFocused: (id) => set({ focusedId: id }),
  toggleCollapsed: (id) => {
    const current = get().collapsed
    const next = { ...current }
    if (next[id]) delete next[id]
    else next[id] = true
    saveCollapsed(next)
    set({ collapsed: next })
  },
  openQuickAdd: (defaults = {}) => set({ quickAdd: { open: true, defaults } }),
  closeQuickAdd: () => set({ quickAdd: { open: false, defaults: {} } }),
  setPalette: (open) => set({ paletteOpen: open }),
  setHelp: (open) => set({ helpOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
