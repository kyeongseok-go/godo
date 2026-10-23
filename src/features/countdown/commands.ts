// 디데이 조작 명령 (순수 함수, ChangeSet 반환). 남은 일수 계산은 domain/stats 의 countdownInfo 를 쓴다.
import { isISODate } from '../../domain/date'
import type { Countdown, ISODate } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { newId } from '../../store/id'

export interface CountdownInput {
  name: string
  date: ISODate
  color: string
  repeatYearly: boolean
}

const ORDER_STEP = 1000

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('디데이 이름을 입력해 주세요')
  return trimmed
}

function assertDate(date: string): ISODate {
  if (!isISODate(date)) throw new Error('날짜를 정해 주세요')
  return date
}

export function createCountdown(
  state: EntityState,
  input: CountdownInput,
): { changes: ChangeSet; countdown: Countdown } {
  const order = Object.values(state.countdowns).reduce((max, c) => Math.max(max, c.order), 0) + ORDER_STEP
  const countdown: Countdown = {
    id: newId(),
    name: normalizeName(input.name),
    date: assertDate(input.date),
    color: input.color,
    repeatYearly: input.repeatYearly,
    order,
  }
  return { countdown, changes: { puts: { countdowns: [countdown] }, deletes: {} } }
}

export function patchCountdown(state: EntityState, id: string, patch: Partial<Countdown>): ChangeSet {
  const current = state.countdowns[id]
  if (!current) return EMPTY_CHANGES
  const merged: Countdown = { ...current, ...patch, id }
  const next: Countdown = { ...merged, name: normalizeName(merged.name), date: assertDate(merged.date) }
  return { puts: { countdowns: [next] }, deletes: {} }
}

export function deleteCountdown(state: EntityState, id: string): ChangeSet {
  return state.countdowns[id] ? { puts: {}, deletes: { countdowns: [id] } } : EMPTY_CHANGES
}
