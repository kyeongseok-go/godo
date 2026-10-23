import { describe, expect, it } from 'vitest'
import { pickSnapshotsToKeep } from './snapshots'

// 로컬 시각으로 만들어서 실행 환경의 타임존과 무관하게 같은 결과가 나오게 한다.
const at = (month: number, day: number, hour = 0, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

const NOW = at(10, 23, 12, 0) // 2026-10-23(금) 정오

const snap = (id: string, createdAt: number): { id: string; createdAt: number } => ({ id, createdAt })

describe('pickSnapshotsToKeep', () => {
  it('returns an empty list when there are no snapshots', () => {
    expect(pickSnapshotsToKeep([], NOW)).toEqual([])
  })

  it('keeps every snapshot from the last 24 hours', () => {
    const list = [snap('a', at(10, 23, 11, 59)), snap('b', at(10, 23, 9, 0)), snap('c', at(10, 22, 13, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['a', 'b', 'c'])
  })

  it('keeps snapshots that are slightly in the future', () => {
    expect(pickSnapshotsToKeep([snap('f', NOW + 60_000)], NOW)).toEqual(['f'])
  })

  it('keeps only the newest snapshot per local day for the last 7 days', () => {
    const list = [
      snap('morning', at(10, 21, 9, 0)),
      snap('evening', at(10, 21, 18, 0)),
      snap('noon', at(10, 21, 12, 0)),
    ]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['evening'])
  })

  it('keeps one snapshot for each different day in the last 7 days', () => {
    const list = [snap('d21', at(10, 21, 9, 0)), snap('d20', at(10, 20, 9, 0)), snap('d17', at(10, 17, 9, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['d21', 'd20', 'd17'])
  })

  it('keeps a day-tier snapshot even when a newer one that day is in the 24 hour window', () => {
    const list = [snap('recent', at(10, 22, 13, 0)), snap('earlier', at(10, 22, 8, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['recent', 'earlier'])
  })

  it('keeps only the newest snapshot per week for the 30 days before the last 7 days', () => {
    // 10/12(월) 주: 10/12, 10/14, 10/16 -> 10/16 만 남는다
    const list = [snap('mon', at(10, 12, 9, 0)), snap('wed', at(10, 14, 18, 0)), snap('fri', at(10, 16, 8, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['fri'])
  })

  it('treats Sunday as the last day of the week that started on Monday', () => {
    // 10/11(일) 은 10/5(월) 주에 속한다
    const list = [snap('sun', at(10, 11, 20, 0)), snap('tue', at(10, 6, 10, 0)), snap('mon-next', at(10, 12, 9, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['sun', 'mon-next'])
  })

  it('moves from the daily tier to the weekly tier at the 7 day boundary', () => {
    const list = [
      snap('daily-edge', at(10, 17, 9, 0)), // 6일 전: 일 단위
      snap('weekly-edge-a', at(10, 16, 9, 0)), // 7일 전: 주 단위
      snap('weekly-edge-b', at(10, 14, 9, 0)),
    ]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['daily-edge', 'weekly-edge-a'])
  })

  it('drops snapshots older than 37 days', () => {
    const list = [snap('keep', at(9, 17, 9, 0)), snap('drop', at(9, 16, 9, 0)), snap('ancient', at(1, 1, 9, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['keep'])
  })

  it('preserves the input order of the ids it keeps', () => {
    const list = [snap('old', at(10, 16, 8, 0)), snap('new', at(10, 23, 11, 0)), snap('mid', at(10, 21, 9, 0))]
    expect(pickSnapshotsToKeep(list, NOW)).toEqual(['old', 'new', 'mid'])
  })

  it('keeps the first one listed when two snapshots share the same time', () => {
    const t = at(10, 20, 9, 0)
    expect(pickSnapshotsToKeep([snap('first', t), snap('second', t)], NOW)).toEqual(['first'])
  })

  it('does not mutate the input list', () => {
    const list = [snap('a', at(10, 21, 9, 0)), snap('b', at(10, 21, 10, 0))]
    const copy = list.map((s) => ({ ...s }))
    pickSnapshotsToKeep(list, NOW)
    expect(list).toEqual(copy)
  })
})
