import { renderHook, waitFor } from '@testing-library/react'
import { useToasts } from '../../ui/toast'
import { db, useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { useAutoSnapshots } from './useAutoSnapshots'

describe('useAutoSnapshots', () => {
  beforeAll(async () => {
    await useApp.getState().load()
  })

  test('creates a snapshot once the app is ready and none exists yet', async () => {
    useApp.getState().commit({ puts: { tasks: [makeTask({ id: 'a', title: '기록 대상', updatedAt: Date.now() })] }, deletes: {} }, '추가')

    renderHook(() => useAutoSnapshots())

    await waitFor(async () => expect(await db.snapshots.count()).toBe(1))
    const [snapshot] = await db.snapshots.toArray()
    expect(snapshot.data).toContain('기록 대상')
  })

  test('does not create another snapshot right away', async () => {
    renderHook(() => useAutoSnapshots())
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(await db.snapshots.count()).toBe(1)
  })

  test('tells the user once when a snapshot cannot be made', async () => {
    useToasts.setState({ toasts: [] })
    vi.spyOn(db.snapshots, 'orderBy').mockImplementation(() => {
      throw new Error('디스크 오류')
    })

    renderHook(() => useAutoSnapshots())

    await waitFor(() => expect(useToasts.getState().toasts).toHaveLength(1))
    expect(useToasts.getState().toasts[0]).toMatchObject({ tone: 'error', message: expect.stringContaining('디스크 오류') })
    vi.restoreAllMocks()
  })
})
