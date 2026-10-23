// 자동 백업 스냅샷. db.snapshots 테이블에 백업 JSON 문자열을 그대로 보관한다.
import type { PaceDB, SnapshotRecord } from '../../db/db'
import { createBackup, parseBackup, pickSnapshotsToKeep, serializeBackup } from '../../domain/exchange'
import type { AppData, ImportResult } from '../../domain/exchange'

export const SNAPSHOT_INTERVAL_MS = 6 * 3_600_000

export interface SnapshotInfo {
  id: string
  createdAt: number
  bytes: number
}

export function shouldTakeSnapshot(input: { lastAt: number | null; nowMs: number; hasChanges: boolean }): boolean {
  if (!input.hasChanges) return false
  if (input.lastAt === null) return true
  return input.nowMs - input.lastAt >= SNAPSHOT_INTERVAL_MS
}

/**
 * 마지막 스냅샷 뒤에 손댄 흔적이 있는지. 시각이 남는 항목(할 일·댓글·활동·프로젝트·템플릿·집중 기록)만 본다.
 * 시각이 없는 항목(습관 기록 등)의 변경은 같은 세션의 dirty 플래그가 보완한다.
 */
export function hasChangesSince(data: AppData, sinceMs: number): boolean {
  return (
    data.tasks.some((t) => t.updatedAt > sinceMs) ||
    data.comments.some((c) => c.createdAt > sinceMs) ||
    data.activity.some((a) => a.at > sinceMs) ||
    data.projects.some((p) => p.createdAt > sinceMs) ||
    data.templates.some((t) => t.createdAt > sinceMs) ||
    data.focusSessions.some((f) => f.startedAt > sinceMs)
  )
}

export async function createSnapshot(db: PaceDB, data: AppData, nowMs: number, id: string): Promise<SnapshotRecord> {
  const text = serializeBackup(createBackup(data, new Date(nowMs).toISOString()))
  const record: SnapshotRecord = { id, createdAt: nowMs, data: text }
  await db.snapshots.put(record)
  return record
}

/** 보관 정책에 걸리지 않는 스냅샷을 지우고 지운 개수를 돌려준다. */
export async function pruneSnapshots(db: PaceDB, nowMs: number): Promise<number> {
  const records = await db.snapshots.toArray()
  const keep = new Set(pickSnapshotsToKeep(records.map((r) => ({ id: r.id, createdAt: r.createdAt })), nowMs))
  const doomed = records.filter((r) => !keep.has(r.id)).map((r) => r.id)
  if (doomed.length > 0) await db.snapshots.bulkDelete(doomed)
  return doomed.length
}

/** 목록용 요약. 크기는 UTF-8 바이트 수다. 최신순. */
export async function listSnapshots(db: PaceDB): Promise<SnapshotInfo[]> {
  const records = await db.snapshots.orderBy('createdAt').reverse().toArray()
  return records.map((r) => ({ id: r.id, createdAt: r.createdAt, bytes: new Blob([r.data]).size }))
}

export async function readSnapshotData(db: PaceDB, id: string): Promise<ImportResult<AppData>> {
  const record = await db.snapshots.get(id)
  if (!record) return { ok: false, error: '스냅샷을 찾지 못했어요. 이미 정리됐을 수 있어요.' }
  const parsed = parseBackup(record.data)
  if (!parsed.ok) return { ok: false, error: `스냅샷을 읽지 못했어요. ${parsed.error}` }
  return { ok: true, value: parsed.value.data, warnings: parsed.warnings }
}

export interface AutoSnapshotInput {
  data: AppData
  /** 이번 세션에서 데이터가 바뀌었는지(스토어 구독으로 알아낸다) */
  dirty: boolean
  nowMs: number
  id: string
}

/** 6시간이 지났고 바뀐 것이 있으면 스냅샷을 만들고 오래된 것을 정리한다. */
export async function runAutoSnapshot(db: PaceDB, input: AutoSnapshotInput): Promise<'created' | 'skipped'> {
  const latest = await db.snapshots.orderBy('createdAt').last()
  const lastAt = latest?.createdAt ?? null
  const hasChanges = input.dirty || lastAt === null || hasChangesSince(input.data, lastAt)
  if (!shouldTakeSnapshot({ lastAt, nowMs: input.nowMs, hasChanges })) return 'skipped'

  await createSnapshot(db, input.data, input.nowMs, input.id)
  await pruneSnapshots(db, input.nowMs)
  return 'created'
}
