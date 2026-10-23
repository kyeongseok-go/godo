import { ArchiveRestore } from 'lucide-react'
import type { Habit } from '../../domain/types'
import type { HabitActions } from './useHabitActions'

interface ArchivedHabitsProps {
  habits: readonly Habit[]
  actions: HabitActions
  onEdit: (habit: Habit) => void
}

/** 하단 접힘 영역. 보관한 습관은 기록을 그대로 두고 목록에서만 빠진다. */
export function ArchivedHabits({ habits, actions, onEdit }: ArchivedHabitsProps) {
  if (habits.length === 0) return null
  return (
    <details className="harchive">
      <summary>보관한 습관 <span>{habits.length}</span></summary>
      <ul>
        {habits.map((habit) => (
          <li key={habit.id}>
            <span className="hrow__dot" style={{ background: habit.color }} aria-hidden="true" />
            <button type="button" className="harchive__name" onClick={() => onEdit(habit)}>
              {habit.name}
            </button>
            <button type="button" className="btn-ghost" onClick={() => actions.archive(habit.id, false)}>
              <ArchiveRestore size={15} aria-hidden="true" /> 복원
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
