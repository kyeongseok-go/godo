// 화면에서 부르는 "실행" 모음. 현재 시각과 최신 스토어를 여기서 읽어 순수 명령에 넘기고 commit 한다.
import type { Placement } from '../../domain/planning'
import type { ID, ISODate } from '../../domain/types'
import { useApp } from '../../store/app'
import { cancelTask } from '../../store/commands/taskCommands'
import { replanChangeSet } from '../replan/flow'
import { applyPlacements, finishEvening, finishMorning, pushToDay, scheduleTasks, setHighlights } from './commands'
import { commitQuiet, commitWithUndo } from './commit'

const entities = () => useApp.getState().entities

/** 후보 한 건을 오늘에 담거나(on) 도로 뺀다 */
export function setPicked(taskId: ID, today: ISODate, on: boolean): void {
  commitQuiet(scheduleTasks(entities(), [taskId], on ? today : null, Date.now()), on ? '오늘로 담기' : '오늘에서 빼기')
}

export function saveHighlights(date: ISODate, ids: readonly ID[]): void {
  commitQuiet(setHighlights(entities(), date, ids), '오늘의 핵심 고르기')
}

/** 여러 일을 다른 날로 밀고 되돌리기 토스트를 띄운다 */
export function pushTasksToDay(ids: readonly ID[], date: ISODate, label: string, message: string): void {
  commitWithUndo(pushToDay(entities(), ids, date, Date.now()), label, message)
}

export function shelveAsSomeday(id: ID, today: ISODate): void {
  commitWithUndo(
    replanChangeSet(entities(), id, { type: 'someday' }, today, Date.now()),
    '못 끝낸 일 언젠가로',
    '언젠가 보관함에 넣었어요',
  )
}

export function cancelPlanned(id: ID): void {
  commitWithUndo(cancelTask(entities(), id, Date.now()), '못 끝낸 일 취소', '계획을 취소했어요')
}

export function applySuggestedPlacements(placements: readonly Placement[]): void {
  commitWithUndo(
    applyPlacements(entities(), placements, Date.now()),
    '자동 배치 적용',
    `${placements.length}개에 시간을 정했어요`,
  )
}

export function completeMorning(date: ISODate): void {
  commitWithUndo(finishMorning(entities(), date, Date.now()), '아침 계획 마침', '아침 계획을 마쳤어요')
}

export function completeEvening(date: ISODate, reflection: string): void {
  commitWithUndo(finishEvening(entities(), date, reflection, Date.now()), '저녁 회고 마침', '오늘 회고를 남겼어요')
}
