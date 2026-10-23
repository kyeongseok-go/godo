// 파일 이름·크기·시각 같은 화면 문구. 순수 함수.
import { toISODate } from '../../domain/date'

const FALLBACK_PROJECT_NAME = '가져온 할 일'
const KB = 1024
const MB = KB * 1024

export function backupFileName(now: Date): string {
  return `pace-backup-${toISODate(now)}.json`
}

export function csvFileName(now: Date): string {
  return `pace-tasks-${toISODate(now)}.csv`
}

/** CSV 파일 이름에서 확장자를 떼어 새 프로젝트 이름의 초깃값으로 쓴다. */
export function csvProjectName(fileName: string): string {
  const name = fileName.trim().replace(/\.csv$/i, '').trim()
  return name === '' ? FALLBACK_PROJECT_NAME : name
}

export function formatBytes(bytes: number): string {
  const n = Math.max(0, bytes)
  if (n < KB) return `${Math.round(n)} B`
  if (n < MB) return `${(n / KB).toFixed(1)} KB`
  return `${(n / MB).toFixed(1)} MB`
}

/** 스냅샷 목록의 시각. 설정의 시간대를 따르고, 시간대 이름이 잘못되면 기기 시간대로 보여 준다. */
export function formatSnapshotTime(ms: number, timeZone: string, timeFormat: '12h' | '24h'): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
  }
  try {
    return new Intl.DateTimeFormat('ko-KR', { ...options, timeZone }).format(ms)
  } catch {
    return new Intl.DateTimeFormat('ko-KR', options).format(ms)
  }
}
