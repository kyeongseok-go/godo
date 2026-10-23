import { PaceDB } from '../../db/db'
import { emptyAppData } from '../../domain/exchange'
import { makeProject, makeTask } from '../../test/factories'
import {
  createSnapshot,
  hasChangesSince,
  listSnapshots,
  pruneSnapshots,
  readSnapshotData,
  runAutoSnapshot,
  shouldTakeSnapshot,
  SNAPSHOT_INTERVAL_MS,
} from './snapshots'

let seq = 0
let db: PaceDB

beforeEach(() => {
  db = new PaceDB(`snap-test-${++seq}`)
})

afterEach(async () => {
  db.close()
  await PaceDB.delete(db.name)
})

const HOUR = 3_600_000
const NOW = new Date(2026, 9, 23, 12, 0).getTime()

describe('shouldTakeSnapshot', () => {
  it('takes the first snapshot when there is none and something changed', () => {
    expect(shouldTakeSnapshot({ lastAt: null, nowMs: NOW, hasChanges: true })).toBe(true)
  })

  it('waits until six hours have passed', () => {
    expect(shouldTakeSnapshot({ lastAt: NOW - SNAPSHOT_INTERVAL_MS + 1, nowMs: NOW, hasChanges: true })).toBe(false)
    expect(shouldTakeSnapshot({ lastAt: NOW - SNAPSHOT_INTERVAL_MS, nowMs: NOW, hasChanges: true })).toBe(true)
  })

  it('skips when nothing changed', () => {
    expect(shouldTakeSnapshot({ lastAt: NOW - 20 * HOUR, nowMs: NOW, hasChanges: false })).toBe(false)
  })

  it('treats a snapshot from the future as recent', () => {
    expect(shouldTakeSnapshot({ lastAt: NOW + HOUR, nowMs: NOW, hasChanges: true })).toBe(false)
  })
})

describe('hasChangesSince', () => {
  it('detects tasks updated after the cutoff', () => {
    const data = { ...emptyAppData(), tasks: [makeTask({ updatedAt: 200 })] }

    expect(hasChangesSince(data, 100)).toBe(true)
    expect(hasChangesSince(data, 200)).toBe(false)
  })

  it('detects projects created after the cutoff', () => {
    const data = { ...emptyAppData(), projects: [makeProject({ createdAt: 300 })] }

    expect(hasChangesSince(data, 100)).toBe(true)
  })

  it('returns false for empty data', () => {
    expect(hasChangesSince(emptyAppData(), 0)).toBe(false)
  })
})

describe('createSnapshot and listSnapshots', () => {
  it('stores a backup JSON and lists it newest first with its size', async () => {
    const data = { ...emptyAppData(), tasks: [makeTask({ id: 'a', title: '우유 사기' })] }
    await createSnapshot(db, data, NOW - HOUR, 's1')
    await createSnapshot(db, data, NOW, 's2')

    const list = await listSnapshots(db)

    expect(list.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(list[0].bytes).toBeGreaterThan(50)
  })

  it('round-trips through readSnapshotData', async () => {
    const task = makeTask({ id: 'a', title: '우유 사기' })
    await createSnapshot(db, { ...emptyAppData(), tasks: [task] }, NOW, 's1')

    const result = await readSnapshotData(db, 's1')

    expect(result.ok && result.value.tasks.map((t) => t.title)).toEqual(['우유 사기'])
  })

  it('reports a Korean error for a missing snapshot', async () => {
    const result = await readSnapshotData(db, 'nope')

    expect(result).toEqual({ ok: false, error: '스냅샷을 찾지 못했어요. 이미 정리됐을 수 있어요.' })
  })

  it('reports a Korean error for a corrupted snapshot', async () => {
    await db.snapshots.put({ id: 'bad', createdAt: NOW, data: '{깨짐' })

    const result = await readSnapshotData(db, 'bad')

    expect(result.ok).toBe(false)
  })
})

describe('pruneSnapshots', () => {
  it('removes snapshots older than the retention window', async () => {
    await createSnapshot(db, emptyAppData(), NOW - 90 * 24 * HOUR, 'old')
    await createSnapshot(db, emptyAppData(), NOW - HOUR, 'fresh')

    const removed = await pruneSnapshots(db, NOW)

    expect(removed).toBe(1)
    expect((await listSnapshots(db)).map((s) => s.id)).toEqual(['fresh'])
  })

  it('does nothing when every snapshot is kept', async () => {
    await createSnapshot(db, emptyAppData(), NOW - HOUR, 'fresh')

    expect(await pruneSnapshots(db, NOW)).toBe(0)
  })
})

describe('runAutoSnapshot', () => {
  const data = { ...emptyAppData(), tasks: [makeTask({ updatedAt: NOW - HOUR })] }

  it('creates the first snapshot', async () => {
    const result = await runAutoSnapshot(db, { data, dirty: false, nowMs: NOW, id: 'first' })

    expect(result).toBe('created')
    expect((await listSnapshots(db)).map((s) => s.id)).toEqual(['first'])
  })

  it('skips when the last snapshot is recent', async () => {
    await createSnapshot(db, data, NOW - HOUR, 'recent')

    expect(await runAutoSnapshot(db, { data, dirty: true, nowMs: NOW, id: 'x' })).toBe('skipped')
  })

  it('skips when the last snapshot is old but nothing changed since', async () => {
    await createSnapshot(db, data, NOW, 'latest')

    const later = NOW + 8 * HOUR
    expect(await runAutoSnapshot(db, { data, dirty: false, nowMs: later, id: 'x' })).toBe('skipped')
  })

  it('creates a new snapshot when old and the session made changes', async () => {
    await createSnapshot(db, data, NOW, 'latest')

    const later = NOW + 8 * HOUR
    expect(await runAutoSnapshot(db, { data, dirty: true, nowMs: later, id: 'next' })).toBe('created')
  })

  it('creates a new snapshot when data was edited after the last snapshot in an earlier session', async () => {
    await createSnapshot(db, data, NOW - 10 * HOUR, 'latest')
    const edited = { ...emptyAppData(), tasks: [makeTask({ updatedAt: NOW - 2 * HOUR })] }

    expect(await runAutoSnapshot(db, { data: edited, dirty: false, nowMs: NOW, id: 'next' })).toBe('created')
  })

  it('prunes expired snapshots after creating one', async () => {
    await createSnapshot(db, data, NOW - 90 * 24 * HOUR, 'ancient')

    await runAutoSnapshot(db, { data, dirty: true, nowMs: NOW, id: 'fresh' })

    expect((await listSnapshots(db)).map((s) => s.id)).toEqual(['fresh'])
  })
})
