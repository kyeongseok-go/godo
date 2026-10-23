import { Camera, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { db, useApp } from '../../store/app'
import { newId } from '../../store/id'
import { useToasts } from '../../ui/toast'
import { ConfirmDialog } from '../settings/ConfirmDialog'
import { Group } from '../settings/fields'
import { collectAppData } from './appData'
import { describeApplyFailure, syncAfterApply } from './applyResult'
import { formatBytes, formatSnapshotTime } from './format'
import { restoreSnapshot } from './importer'
import { createSnapshot, listSnapshots, pruneSnapshots } from './snapshots'
import type { SnapshotInfo } from './snapshots'

function describe(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

/** version 이 바뀌면(다른 구역에서 스냅샷이 생기거나 지워졌을 때) 목록을 다시 읽는다. */
function useSnapshotList(externalVersion: number): { items: SnapshotInfo[] | null; loadError: string | null; refresh: () => void } {
  const [items, setItems] = useState<SnapshotInfo[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    listSnapshots(db).then(
      (list) => {
        if (cancelled) return
        setItems(list)
        setLoadError(null)
      },
      (e: unknown) => {
        if (!cancelled) setLoadError(`스냅샷 목록을 불러오지 못했어요. (${describe(e)})`)
      },
    )
    return () => {
      cancelled = true
    }
  }, [version, externalVersion])
  return { items, loadError, refresh }
}

/** 지금 만들기와 복원. 끝나면 목록을 다시 읽는다. */
function useSnapshotActions(refresh: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<SnapshotInfo | null>(null)

  const run = async (task: () => Promise<void>, whatFailed: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (e: unknown) {
      setError(describeApplyFailure(e, whatFailed))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const createNow = (): Promise<void> =>
    run(async () => {
      const nowMs = Date.now()
      await createSnapshot(db, collectAppData(useApp.getState()), nowMs, newId())
      await pruneSnapshots(db, nowMs)
      useToasts.getState().push('스냅샷을 만들었어요')
    }, '스냅샷 만들기')

  const restore = async (): Promise<void> => {
    if (!restoring) return
    const target = restoring
    await run(async () => {
      const result = await restoreSnapshot(db, target.id, { nowMs: Date.now(), newId })
      if (!result.ok) return setError(result.error)
      await syncAfterApply()
      // 검증에서 걸러진 항목이 있으면 숨기지 않고 알려 준다(복원본에 그만큼이 빠져 있다)
      const skipped = result.warnings.length > 0 ? ` (${result.warnings.join(' · ')})` : ''
      useToasts.getState().push(`스냅샷 시점으로 복원했어요${skipped}`, result.warnings.length > 0 ? { ttlMs: 12000 } : undefined)
    }, '복원')
    setRestoring(null)
  }

  return { busy, error, restoring, setRestoring, createNow, restore }
}

interface SnapshotListProps {
  items: SnapshotInfo[]
  busy: boolean
  onRestore: (item: SnapshotInfo) => void
}

function SnapshotList({ items, busy, onRestore }: SnapshotListProps) {
  const settings = useApp((s) => s.settings)
  const timeOf = (item: SnapshotInfo): string => formatSnapshotTime(item.createdAt, settings.timeZone, settings.timeFormat)
  return (
    <ul className="dt-snap__list" aria-label="스냅샷 목록">
      {items.map((item) => (
        <li key={item.id} className="dt-snap__item">
          <div>
            <p className="dt-snap__time">{timeOf(item)}</p>
            <p className="dt-snap__size">{formatBytes(item.bytes)}</p>
          </div>
          <button type="button" className="st-btn" disabled={busy} aria-label={`${timeOf(item)} 스냅샷으로 복원`} onClick={() => onRestore(item)}>
            <RotateCcw size={14} aria-hidden="true" /> 복원
          </button>
        </li>
      ))}
    </ul>
  )
}

export function SnapshotSection({ version }: { version: number }) {
  const { items, loadError, refresh } = useSnapshotList(version)
  const actions = useSnapshotActions(refresh)
  const settings = useApp((s) => s.settings)
  const problem = actions.error ?? loadError
  const restoringTime = actions.restoring ? formatSnapshotTime(actions.restoring.createdAt, settings.timeZone, settings.timeFormat) : ''

  return (
    <Group title="자동 백업 스냅샷" description="변경이 있으면 6시간마다 이 브라우저 안에 저장해요. 최근 24시간은 모두, 이후 7일은 하루 1개, 그 뒤 30일은 한 주에 1개를 보관해요.">
      <div className="dt-snap">
        <button type="button" className="st-btn" disabled={actions.busy} onClick={() => void actions.createNow()}>
          <Camera size={15} aria-hidden="true" /> 지금 스냅샷 만들기
        </button>
        {problem ? (
          <p className="dt-error" role="alert">
            {problem}
          </p>
        ) : null}
        {items === null ? <p className="dt-muted">불러오는 중…</p> : null}
        {items?.length === 0 ? <p className="dt-muted">아직 스냅샷이 없어요. 앱을 쓰다 보면 자동으로 만들어져요.</p> : null}
        {items && items.length > 0 ? <SnapshotList items={items} busy={actions.busy} onRestore={actions.setRestoring} /> : null}
      </div>

      <ConfirmDialog
        open={actions.restoring !== null}
        title="이 시점으로 복원할까요?"
        confirmLabel="복원"
        danger
        busy={actions.busy}
        onCancel={() => actions.setRestoring(null)}
        onConfirm={() => void actions.restore()}
      >
        <p>
          <strong>현재 데이터는 사라져요.</strong> {restoringTime}의 상태로 바뀌어요.
        </p>
        <p>복원하기 직전 상태도 스냅샷으로 남겨 둬요.</p>
      </ConfirmDialog>
    </Group>
  )
}
