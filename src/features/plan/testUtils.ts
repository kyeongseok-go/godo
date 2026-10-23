// 컴포넌트 테스트 전용: 실제 스토어에 작업을 심고 초기화한다.
import type { DayPlan, Task } from '../../domain/types'
import { useApp } from '../../store/app'
import { applyChangeSet, emptyEntityState } from '../../store/changes'
import { defaultSettings } from '../../store/defaults'
import type { Settings } from '../../domain/types'

export function seedStore(tasks: Task[], plans: DayPlan[] = [], settings: Partial<Settings> = {}): void {
  const entities = applyChangeSet(emptyEntityState(), { puts: { tasks, dayPlans: plans }, deletes: {} }).next
  useApp.setState({
    ready: true,
    entities,
    settings: { ...defaultSettings(), ...settings },
    undoStack: [],
    redoStack: [],
  })
}

export const taskOf = (id: string): Task => useApp.getState().entities.tasks[id]
export const planOf = (date: string): DayPlan | undefined => useApp.getState().entities.dayPlans[date]
