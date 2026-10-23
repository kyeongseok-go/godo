// 자동 백업 스냅샷 보관 정책. 지울 것이 아니라 "남길" id 를 돌려준다. 날짜 경계는 로컬 달력 기준이다.
import { daysBetween, startOfWeek, toISODate } from '../date'

const DAY_MS = 86_400_000
const KEEP_ALL_MS = DAY_MS // 최근 24시간은 전부
const DAILY_DAYS = 7 // 그 뒤 7일은 하루 1개
const WEEKLY_DAYS = 30 // 다시 그 뒤 30일은 주 1개
const MONDAY = 1

interface Snapshot {
  id: string
  createdAt: number
}

type Tier = { kind: 'all' } | { kind: 'bucket'; bucket: string } | { kind: 'drop' }

function classify(snapshot: Snapshot, nowMs: number): Tier {
  if (nowMs - snapshot.createdAt < KEEP_ALL_MS) return { kind: 'all' }

  const day = toISODate(new Date(snapshot.createdAt))
  const daysAgo = daysBetween(day, toISODate(new Date(nowMs)))
  if (daysAgo < DAILY_DAYS) return { kind: 'bucket', bucket: `day:${day}` }
  if (daysAgo < DAILY_DAYS + WEEKLY_DAYS) return { kind: 'bucket', bucket: `week:${startOfWeek(day, MONDAY)}` }
  return { kind: 'drop' }
}

/** 최근 24시간은 전부, 7일 안은 하루 1개, 그 뒤 30일은 주(월요일 시작) 1개, 나머지는 버린다. */
export function pickSnapshotsToKeep(snapshots: ReadonlyArray<Snapshot>, nowMs: number): string[] {
  const keep = new Set<string>()
  const newestPerBucket = new Map<string, Snapshot>()

  for (const snapshot of snapshots) {
    const tier = classify(snapshot, nowMs)
    if (tier.kind === 'all') keep.add(snapshot.id)
    if (tier.kind !== 'bucket') continue
    const best = newestPerBucket.get(tier.bucket)
    if (!best || snapshot.createdAt > best.createdAt) newestPerBucket.set(tier.bucket, snapshot)
  }

  for (const best of newestPerBucket.values()) keep.add(best.id)
  return snapshots.filter((s) => keep.has(s.id)).map((s) => s.id)
}
