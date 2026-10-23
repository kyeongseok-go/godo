import { describe, expect, it } from 'vitest'
import { backupFileName, csvFileName, csvProjectName, formatBytes, formatSnapshotTime } from './format'

describe('file names', () => {
  it('names the backup after the local date', () => {
    expect(backupFileName(new Date(2026, 9, 3, 23, 59))).toBe('godo-backup-2026-10-03.json')
  })

  it('names the csv export after the local date', () => {
    expect(csvFileName(new Date(2026, 0, 9))).toBe('godo-tasks-2026-01-09.csv')
  })
})

describe('csvProjectName', () => {
  it('drops the extension and surrounding spaces', () => {
    expect(csvProjectName('  Todoist 내보내기.csv ')).toBe('Todoist 내보내기')
  })

  it('falls back when the name is empty', () => {
    expect(csvProjectName('.csv')).toBe('가져온 할 일')
    expect(csvProjectName('')).toBe('가져온 할 일')
  })
})

describe('formatBytes', () => {
  it('uses B, KB and MB with one decimal', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('never goes negative', () => {
    expect(formatBytes(-4)).toBe('0 B')
  })
})

describe('formatSnapshotTime', () => {
  const at = new Date(Date.UTC(2026, 9, 23, 6, 5)).getTime()

  it('formats in the requested time zone', () => {
    expect(formatSnapshotTime(at, 'Asia/Seoul', '24h')).toContain('15:05')
  })

  it('falls back to the local zone when the zone is invalid', () => {
    expect(formatSnapshotTime(at, 'Not/AZone', '24h')).toMatch(/2026/)
  })
})
