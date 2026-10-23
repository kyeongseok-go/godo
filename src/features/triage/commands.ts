// F8: 처리 모드의 결정을 변경 집합으로 바꾼다
import type { ID, ISODate } from '../../domain/types'
import { EMPTY_CHANGES } from '../../store/changes'
import type { ChangeSet, EntityState } from '../../store/changes'
import { patchTask } from '../../store/commands/taskCommands'
import { addDays } from '../../domain/date'
import { replanChangeSet } from '../replan/flow'
import type { TriageDecision } from './logic'

export function triageChangeSet(
  state: EntityState,
  taskId: ID,
  decision: TriageDecision,
  today: ISODate,
  nowMs: number,
): ChangeSet {
  if (!state.tasks[taskId]) return EMPTY_CHANGES
  switch (decision.type) {
    case 'skip':
      return EMPTY_CHANGES
    case 'accept': {
      // 프로젝트가 바뀌면 하위 작업도 같이 옮겨지고, 섹션은 이전 프로젝트 것이라 비워진다
      const dated = decision.date === null ? {} : { startDate: decision.date }
      return patchTask(state, taskId, { projectId: decision.projectId, sectionId: null, ...dated }, nowMs)
    }
    case 'today':
      return patchTask(state, taskId, { startDate: today }, nowMs)
    case 'tomorrow':
      return patchTask(state, taskId, { startDate: addDays(today, 1) }, nowMs)
    case 'someday':
      return replanChangeSet(state, taskId, { type: 'someday' }, today, nowMs)
    case 'delete':
      return replanChangeSet(state, taskId, { type: 'delete' }, today, nowMs)
  }
}
