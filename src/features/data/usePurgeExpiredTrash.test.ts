import { renderHook, waitFor } from '@testing-library/react'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { usePurgeExpiredTrash } from './usePurgeExpiredTrash'

const DAY = 86_400_000

describe('usePurgeExpiredTrash', () => {
  beforeAll(async () => {
    await useApp.getState().load()
  })

  test('removes trash older than 30 days and keeps recent trash', async () => {
    const now = Date.now()
    const stale = makeTask({ id: 'stale', deletedAt: now - 31 * DAY })
    const recent = makeTask({ id: 'recent', deletedAt: now - 2 * DAY })
    const live = makeTask({ id: 'live' })
    useApp.getState().commit({ puts: { tasks: [stale, recent, live] }, deletes: {} }, '준비', { history: false })

    renderHook(() => usePurgeExpiredTrash())

    await waitFor(() => expect(Object.keys(useApp.getState().entities.tasks).sort()).toEqual(['live', 'recent']))
  })

  test('does not add an undo entry', () => {
    expect(useApp.getState().undoStack).toHaveLength(0)
  })
})
