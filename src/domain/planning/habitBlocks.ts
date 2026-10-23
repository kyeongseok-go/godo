// F12: 유연한 습관 블록. 고정 시각이 아니라 그날 일정에 맞춰 습관에 쓸 시간을 다시 찾는다.
import { minutesOfDay, timeFromMinutes } from '../date'
import { isHabitDone, isHabitDue } from '../stats'
import type { Habit, ID, ISODate, TimeOfDay } from '../types'
import { findFreeStart } from './slots'
import type { BusyBlock, Interval } from './slots'

export interface HabitBlockPlacement {
  habitId: ID
  date: ISODate
  startTime: TimeOfDay
  durationMin: number
}

export interface HabitBlockFailure {
  habitId: ID
  reason: string
}

export interface HabitBlockOptions {
  date: ISODate
  /** 그 날짜가 오늘이면 지금 시각(지나간 자리를 제안하지 않는다). 오늘이 아니면 null */
  nowTime: TimeOfDay | null
  bufferMin: number
  /** 시작 시각을 맞추는 간격(분) */
  slotMin: number
}

/** 블록이 있고, 보관되지 않았고, 그날 해야 하고, 아직 못 한 습관만 시간을 잡는다. */
function needsBlock(habit: Habit, date: ISODate): boolean {
  return habit.block !== null && isHabitDue(habit, date) && !isHabitDone(habit, date)
}

/**
 * 같은 입력이면 항상 같은 결과가 나오도록 order, id 까지 비교한다.
 * 앞선 습관이 먼저 자리를 잡고, 뒤 습관은 그 자리를 피한다.
 */
export function planHabitBlocks(
  habits: readonly Habit[],
  busy: readonly BusyBlock[],
  opts: HabitBlockOptions,
): { blocks: HabitBlockPlacement[]; failures: HabitBlockFailure[] } {
  const taken: Interval[] = busy
    .filter((b) => b.date === opts.date)
    .map((b) => ({ start: minutesOfDay(b.start), end: minutesOfDay(b.end) }))
    .filter((i) => i.end > i.start)
  const blocks: HabitBlockPlacement[] = []
  const failures: HabitBlockFailure[] = []

  const ordered = habits
    .filter((habit) => needsBlock(habit, opts.date))
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  for (const habit of ordered) {
    // needsBlock 이 통과했으면 block 은 반드시 있다
    const block = habit.block as NonNullable<Habit['block']>
    const window: Interval = { start: minutesOfDay(block.start), end: minutesOfDay(block.end) }
    const minutes = Math.floor(block.durationMin)
    if (window.end <= window.start) {
      failures.push({ habitId: habit.id, reason: '블록 시간대가 올바르지 않아요(끝이 시작보다 빨라요)' })
      continue
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      failures.push({ habitId: habit.id, reason: '블록 길이가 올바르지 않아요' })
      continue
    }
    if (minutes > window.end - window.start) {
      failures.push({
        habitId: habit.id,
        reason: `${block.start}–${block.end} 사이가 ${minutes}분보다 짧아요`,
      })
      continue
    }
    const start = findFreeStart(taken, minutes, window, {
      slotMin: opts.slotMin,
      bufferMin: opts.bufferMin,
      notBefore: opts.nowTime === null ? undefined : minutesOfDay(opts.nowTime),
    })
    if (start === null) {
      failures.push({ habitId: habit.id, reason: `${block.start}–${block.end} 안에 빈 시간이 없어요` })
      continue
    }
    taken.push({ start, end: start + minutes })
    blocks.push({ habitId: habit.id, date: opts.date, startTime: timeFromMinutes(start), durationMin: minutes })
  }

  return { blocks, failures }
}

/** 습관 블록을 자동 배치가 피해 갈 외부 일정으로 바꾼다. */
export function habitBlocksAsBusy(blocks: readonly HabitBlockPlacement[]): BusyBlock[] {
  return blocks.map((b) => ({
    date: b.date,
    start: b.startTime,
    end: timeFromMinutes(minutesOfDay(b.startTime) + b.durationMin),
  }))
}
