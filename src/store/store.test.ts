import { PaceDB } from '../db/db'
import { INBOX_ID } from '../domain/types'
import { makeTask } from '../test/factories'
import { createAppStore } from './store'
import type { AppStore } from './store'

let seq = 0
let db: PaceDB
let store: AppStore

async function flushWrites(): Promise<void> {
  // 영속화는 비동기로 흘러가므로 트랜잭션이 끝날 때까지 한 번 기다린다.
  await db.tasks.count()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(async () => {
  db = new PaceDB(`test-${++seq}`)
  store = createAppStore(db, () => 1_000)
  await store.getState().load()
})

afterEach(async () => {
  db.close()
  await PaceDB.delete(db.name)
})

describe('app store', () => {
  test('creates the inbox project and default settings on first load', () => {
    const s = store.getState()

    expect(s.ready).toBe(true)
    expect(s.entities.projects[INBOX_ID].name).toBe('받은편지함')
    expect(s.settings.weekStartsOn).toBe(1)
  })

  test('commit updates state and persists to IndexedDB', async () => {
    const task = makeTask({ id: 'a', title: '우유 사기' })

    store.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '할 일 추가')
    await flushWrites()

    expect(store.getState().entities.tasks.a.title).toBe('우유 사기')
    expect((await db.tasks.get('a'))?.title).toBe('우유 사기')
  })

  test('undo reverts the last commit and redo re-applies it', async () => {
    const task = makeTask({ id: 'a' })
    store.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '할 일 추가')

    const undone = store.getState().undo()
    await flushWrites()
    expect(undone).toBe('할 일 추가')
    expect(store.getState().entities.tasks.a).toBeUndefined()
    expect(await db.tasks.get('a')).toBeUndefined()

    const redone = store.getState().redo()
    await flushWrites()
    expect(redone).toBe('할 일 추가')
    expect(store.getState().entities.tasks.a).toBeDefined()
    expect(await db.tasks.get('a')).toBeDefined()
  })

  test('a new commit clears the redo stack', () => {
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })] }, deletes: {} }, '추가 A')
    store.getState().undo()

    store.getState().commit({ puts: { tasks: [makeTask({ id: 'b' })] }, deletes: {} }, '추가 B')

    expect(store.getState().redoStack).toHaveLength(0)
    expect(store.getState().redo()).toBeNull()
  })

  test('history:false commits are not undoable', () => {
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })] }, deletes: {} }, '자동', { history: false })

    expect(store.getState().undoStack).toHaveLength(0)
  })

  test('keeps at most 100 undo entries', () => {
    for (let i = 0; i < 120; i++) {
      store.getState().commit({ puts: { tasks: [makeTask({ id: `t${i}` })] }, deletes: {} }, `n${i}`)
    }

    expect(store.getState().undoStack).toHaveLength(100)
  })

  test('empty change sets are ignored', () => {
    store.getState().commit({ puts: {}, deletes: {} }, '빈 변경')

    expect(store.getState().undoStack).toHaveLength(0)
  })

  test('reloads previously saved data in a fresh store', async () => {
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'a', title: '유지' })] }, deletes: {} }, '추가')
    await flushWrites()

    const fresh = createAppStore(db, () => 2_000)
    await fresh.getState().load()

    expect(fresh.getState().entities.tasks.a.title).toBe('유지')
  })

  test('calling load twice reads once, so later changes are not overwritten by stale data', async () => {
    const fresh = createAppStore(db, () => 3_000)
    const first = fresh.getState().load()
    const second = fresh.getState().load()
    await Promise.all([first, second])
    fresh.getState().commit({ puts: { tasks: [makeTask({ id: 'kept' })] }, deletes: {} }, '추가')

    await fresh.getState().load()

    expect(fresh.getState().entities.tasks.kept).toBeDefined()
  })

  test('reload re-reads the database', async () => {
    await db.tasks.put(makeTask({ id: 'external' }))

    await store.getState().reload()

    expect(store.getState().entities.tasks.external).toBeDefined()
  })

  test('updateSettings persists the new value', async () => {
    store.getState().updateSettings({ density: 'compact' })
    await flushWrites()

    expect(store.getState().settings.density).toBe('compact')
    expect((await db.settings.get('settings'))?.density).toBe('compact')
  })
})

describe('failure handling', () => {
  test('a failed initial read sets loadError and can be retried', async () => {
    const broken = new PaceDB(`test-broken-${++seq}`)
    const fresh = createAppStore(broken, () => 4_000)
    const spy = vi.spyOn(broken, 'table').mockImplementation(() => {
      throw new Error('boom')
    })

    await expect(fresh.getState().load()).rejects.toThrow('boom')
    expect(fresh.getState().loadError).toContain('읽지 못했어요')
    expect(fresh.getState().ready).toBe(false)

    spy.mockRestore()
    await fresh.getState().load()

    expect(fresh.getState().ready).toBe(true)
    expect(fresh.getState().loadError).toBeNull()
    broken.close()
    await PaceDB.delete(broken.name)
  })

  test('a failed write keeps persistError, even after a later write succeeds', async () => {
    // 쓰기는 몇 번 다시 시도하므로, 끝까지 실패하는 상황을 만든다
    const spy = vi.spyOn(db, 'transaction').mockRejectedValue(new Error('quota'))

    store.getState().commit({ puts: { tasks: [makeTask({ id: 'lost' })] }, deletes: {} }, '추가 실패')
    await vi.waitFor(() => expect(store.getState().persistError).toContain('저장하지 못했어요'))

    spy.mockRestore()
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'ok' })] }, deletes: {} }, '추가 성공')
    await flushWrites()

    expect(store.getState().persistError).toContain('quota')
    store.getState().dismissError()
    expect(store.getState().persistError).toBeNull()
  })

  test('잠깐 실패한 쓰기는 다시 시도해 저장한다', async () => {
    const spy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('잠깐 잠김'))

    store.getState().commit({ puts: { tasks: [makeTask({ id: 'retried' })] }, deletes: {} }, '추가')
    await vi.waitFor(async () => expect(await db.tasks.get('retried')).toBeDefined())

    expect(store.getState().persistError).toBeNull()
    spy.mockRestore()
  })

  test('keeps the first error instead of overwriting it', async () => {
    const spy = vi.spyOn(db, 'transaction').mockRejectedValue(new Error('first'))
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })] }, deletes: {} }, 'a')
    await vi.waitFor(() => expect(store.getState().persistError).toContain('first'))

    spy.mockRejectedValue(new Error('second'))
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'b' })] }, deletes: {} }, 'b')
    await vi.waitFor(() => expect(store.getState().pendingWrites).toBe(0))

    expect(store.getState().persistError).toContain('first')
    expect(store.getState().persistError).not.toContain('second')
    spy.mockRestore()
  })

  test('pendingWrites counts in-flight writes and returns to zero', async () => {
    store.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })] }, deletes: {} }, 'a')
    expect(store.getState().pendingWrites).toBeGreaterThan(0)

    await vi.waitFor(() => expect(store.getState().pendingWrites).toBe(0))
  })

  test('calls onPersisted after a successful write', async () => {
    const onPersisted = vi.fn()
    const synced = createAppStore(db, () => 5_000, { onPersisted })
    await synced.getState().load()

    synced.getState().commit({ puts: { tasks: [makeTask({ id: 'a' })] }, deletes: {} }, 'a')

    await vi.waitFor(() => expect(onPersisted).toHaveBeenCalled())
  })

  test('fills settings fields missing from an older saved version', async () => {
    const old = { ...(await db.settings.get('settings')), pomodoro: { focusMin: 50 } } as never
    await db.settings.put(old)

    await store.getState().reload()

    const pomodoro = store.getState().settings.pomodoro
    expect(pomodoro.focusMin).toBe(50)
    expect(pomodoro.shortBreakMin).toBe(5)
    expect(store.getState().settings.modules.habits).toBe(true)
  })
})

describe('실행 취소가 건드리지 않은 필드', () => {
  test('되돌릴 때 그 사이에 다른 경로가 바꾼 값은 지키고 되돌릴 필드만 돌려놓는다', async () => {
    const task = makeTask({ id: 't1', title: '원래 제목', actualMin: {} })
    store.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가', { history: false })

    // 제목 수정(실행 취소 대상)
    const renamed = { ...store.getState().entities.tasks.t1, title: '바뀐 제목' }
    store.getState().commit({ puts: { tasks: [renamed] }, deletes: {} }, '제목 수정')

    // 집중 세션 기록처럼 실행 취소에 남기지 않는 쓰기
    const tracked = { ...store.getState().entities.tasks.t1, actualMin: { '2026-10-23': 25 } }
    store.getState().commit({ puts: { tasks: [tracked] }, deletes: {} }, '집중 기록', { history: false })

    store.getState().undo()

    const after = store.getState().entities.tasks.t1
    expect(after.title).toBe('원래 제목')
    expect(after.actualMin).toEqual({ '2026-10-23': 25 })
    await flushWrites()
    expect((await db.tasks.get('t1'))?.actualMin).toEqual({ '2026-10-23': 25 })
  })

  test('다시 실행도 같은 규칙을 따른다', () => {
    const task = makeTask({ id: 't1', title: '원래 제목' })
    store.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가', { history: false })
    const renamed = { ...task, title: '바뀐 제목' }
    store.getState().commit({ puts: { tasks: [renamed] }, deletes: {} }, '제목 수정')
    store.getState().undo()

    const tracked = { ...store.getState().entities.tasks.t1, actualMin: { '2026-10-23': 10 } }
    store.getState().commit({ puts: { tasks: [tracked] }, deletes: {} }, '집중 기록', { history: false })
    store.getState().redo()

    const after = store.getState().entities.tasks.t1
    expect(after.title).toBe('바뀐 제목')
    expect(after.actualMin).toEqual({ '2026-10-23': 10 })
  })

  test('만들기를 되돌리면 행이 사라진다(좁히기와 무관)', () => {
    const task = makeTask({ id: 't1' })
    store.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가')

    store.getState().undo()

    expect(store.getState().entities.tasks.t1).toBeUndefined()
  })

  test('지우기를 되돌리면 행 전체가 돌아온다', () => {
    const task = makeTask({ id: 't1', title: '지울 일' })
    store.getState().commit({ puts: { tasks: [task] }, deletes: {} }, '추가', { history: false })
    store.getState().commit({ puts: {}, deletes: { tasks: ['t1'] } }, '삭제')

    store.getState().undo()

    expect(store.getState().entities.tasks.t1.title).toBe('지울 일')
  })
})

describe('다시 읽기와 쓰기가 겹칠 때', () => {
  test('다시 읽는 동안 들어온 변경이 화면에서 사라지지 않는다', async () => {
    const first = makeTask({ id: 't1', title: '먼저' })
    store.getState().commit({ puts: { tasks: [first] }, deletes: {} }, '추가')

    const reloading = store.getState().reload()
    const second = makeTask({ id: 't2', title: '읽는 중에 추가' })
    store.getState().commit({ puts: { tasks: [second] }, deletes: {} }, '추가')
    await reloading
    await flushWrites()

    expect(Object.keys(store.getState().entities.tasks).sort()).toEqual(['t1', 't2'])
  })

  test('다시 읽기는 다른 탭이 쓴 데이터를 가져온다', async () => {
    await db.tasks.put(makeTask({ id: 'other', title: '다른 탭이 쓴 일' }))

    await store.getState().reload()

    expect(store.getState().entities.tasks.other?.title).toBe('다른 탭이 쓴 일')
  })
})
