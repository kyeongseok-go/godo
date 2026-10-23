import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { PaceDB } from '../db/db'
import { loadAll, persistChanges, persistSettings } from '../db/persist'
import { INBOX_ID } from '../domain/types'
import type { Settings } from '../domain/types'
import { applyChangeSet, emptyEntityState, isEmptyChangeSet } from './changes'
import type { ChangeSet, EntityState } from './changes'
import { defaultSettings, inboxProject, mergeSettings } from './defaults'

const HISTORY_LIMIT = 100

interface HistoryEntry {
  label: string
  forward: ChangeSet
  inverse: ChangeSet
}

export interface AppState {
  ready: boolean
  entities: EntityState
  settings: Settings
  undoStack: readonly HistoryEntry[]
  redoStack: readonly HistoryEntry[]
  /** 저장에 실패하면 문구가 채워진다. 이후 저장이 성공해도 사용자가 닫을 때까지 남는다(놓치지 않도록). */
  persistError: string | null
  /** 아직 DB에 쓰는 중인 변경 수. 0이 아니면 탭을 닫거나 다른 탭의 변경으로 다시 읽으면 안 된다. */
  pendingWrites: number
  /** 처음 읽기에 실패했을 때의 문구. 화면 전체를 오류 안내로 바꾼다. */
  loadError: string | null
  load: () => Promise<void>
  /** 변경을 상태와 DB에 반영하고 실행 취소 기록에 남긴다. */
  commit: (cs: ChangeSet, label: string, opts?: { history?: boolean }) => void
  undo: () => string | null
  redo: () => string | null
  updateSettings: (patch: Partial<Settings>) => void
  dismissError: () => void
  /** 가져오기 등으로 DB가 통째로 바뀐 뒤 메모리 상태를 다시 읽는다. */
  reload: () => Promise<void>
}

export type AppStore = UseBoundStore<StoreApi<AppState>>

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

export interface StoreOptions {
  /** DB에 쓰기가 성공할 때마다 불린다(다른 탭에 알리는 용도) */
  onPersisted?: () => void
}

export function createAppStore(db: PaceDB, now: () => number = Date.now, options: StoreOptions = {}): AppStore {
  return create<AppState>((set, get) => {
    // 모든 쓰기는 이 래퍼를 지난다: 진행 수를 세고, 실패는 사용자가 닫을 때까지 남기며, 성공은 다른 탭에 알린다.
    const track = (work: Promise<void>, failure: (error: unknown) => string): void => {
      set((s) => ({ pendingWrites: s.pendingWrites + 1 }))
      work
        .then(() => options.onPersisted?.())
        .catch((error: unknown) => {
          // 먼저 난 오류를 덮어쓰지 않는다. 처음 원인이 가장 중요하다.
          set((s) => ({ persistError: s.persistError ?? failure(error) }))
        })
        .finally(() => set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) })))
    }

    const persist = (cs: ChangeSet): void =>
      track(
        persistChanges(db, cs),
        (error) => `저장하지 못했어요. 이 탭을 닫거나 새로고침하면 방금 변경이 사라질 수 있어요. 설정에서 백업을 내려받아 두세요. (${describeError(error)})`,
      )

    const applyAndPersist = (cs: ChangeSet): ChangeSet => {
      const { next, inverse } = applyChangeSet(get().entities, cs)
      set({ entities: next })
      persist(cs)
      return inverse
    }

    const initialize = async (): Promise<void> => {
      const loaded = await loadAll(db)
      let entities = loaded.entities
      // 저장된 설정에 새로 생긴 필드를 기본값으로 채운다.
      const settings = mergeSettings(loaded.settings)
      if (!loaded.settings) await persistSettings(db, settings)
      if (!entities.projects[INBOX_ID]) {
        const inbox = inboxProject(now())
        await persistChanges(db, { puts: { projects: [inbox] }, deletes: {} })
        entities = applyChangeSet(entities, { puts: { projects: [inbox] }, deletes: {} }).next
      }
      set({ entities, settings, ready: true, loadError: null, undoStack: [], redoStack: [] })
    }

    // load()가 여러 번 불려도(React StrictMode 등) 실제 읽기는 한 번만 한다.
    // 늦게 끝난 두 번째 읽기가 그 사이의 변경을 오래된 데이터로 덮어쓰는 것을 막는다.
    let initializing: Promise<void> | null = null
    // 읽기에 실패하면 결과를 캐시하지 않아 다시 시도할 수 있고, 화면에는 오류 안내를 띄운다.
    const start = (): Promise<void> => {
      const run = initialize().catch((error: unknown) => {
        initializing = null
        set({ loadError: `저장된 데이터를 읽지 못했어요. (${describeError(error)})` })
        throw error
      })
      initializing = run
      return run
    }

    return {
      ready: false,
      entities: emptyEntityState(),
      settings: defaultSettings(),
      undoStack: [],
      redoStack: [],
      persistError: null,
      pendingWrites: 0,
      loadError: null,
      load: () => initializing ?? start(),
      reload: () => start(),

      commit: (cs, label, opts) => {
        if (isEmptyChangeSet(cs)) return
        const inverse = applyAndPersist(cs)
        if (opts?.history === false) return
        const entry: HistoryEntry = { label, forward: cs, inverse }
        set((s) => ({ undoStack: [...s.undoStack, entry].slice(-HISTORY_LIMIT), redoStack: [] }))
      },

      undo: () => {
        const { undoStack } = get()
        const entry = undoStack[undoStack.length - 1]
        if (!entry) return null
        const redoInverse = applyAndPersist(entry.inverse)
        set((s) => ({
          undoStack: s.undoStack.slice(0, -1),
          redoStack: [...s.redoStack, { label: entry.label, forward: entry.inverse, inverse: redoInverse }],
        }))
        return entry.label
      },

      redo: () => {
        const { redoStack } = get()
        const entry = redoStack[redoStack.length - 1]
        if (!entry) return null
        const undoInverse = applyAndPersist(entry.inverse)
        set((s) => ({
          redoStack: s.redoStack.slice(0, -1),
          undoStack: [...s.undoStack, { label: entry.label, forward: entry.inverse, inverse: undoInverse }],
        }))
        return entry.label
      },

      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch }
        set({ settings })
        track(persistSettings(db, settings), (error) => `설정을 저장하지 못했어요. (${describeError(error)})`)
      },

      dismissError: () => set({ persistError: null }),
    }
  })
}
