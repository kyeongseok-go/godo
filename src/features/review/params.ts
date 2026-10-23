// 리뷰 기준(묵은 일수·미룬 횟수) ↔ URL 검색 파라미터.
import type { ReviewOptions } from '../../domain/planning'

export const DEFAULT_STALE_DAYS = 14
export const DEFAULT_POSTPONE_THRESHOLD = 3
export const STALE_DAYS_RANGE = { min: 1, max: 365 } as const
export const POSTPONE_RANGE = { min: 1, max: 99 } as const

const STALE_KEY = 'stale'
const POSTPONED_KEY = 'postponed'

function readInt(raw: string | null, fallback: number, range: { min: number; max: number }): number {
  if (raw === null || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(range.max, Math.max(range.min, Math.round(value)))
}

export function parseReviewParams(search: URLSearchParams): ReviewOptions {
  return {
    staleDays: readInt(search.get(STALE_KEY), DEFAULT_STALE_DAYS, STALE_DAYS_RANGE),
    postponeThreshold: readInt(search.get(POSTPONED_KEY), DEFAULT_POSTPONE_THRESHOLD, POSTPONE_RANGE),
  }
}

/** 기본값과 같은 기준은 주소에 쓰지 않는다. base 의 다른 키(예: task)는 보존한다. */
export function writeReviewParams(options: ReviewOptions, base?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete(STALE_KEY)
  next.delete(POSTPONED_KEY)
  if (options.staleDays !== DEFAULT_STALE_DAYS) next.set(STALE_KEY, String(options.staleDays))
  if (options.postponeThreshold !== DEFAULT_POSTPONE_THRESHOLD) next.set(POSTPONED_KEY, String(options.postponeThreshold))
  return next
}
