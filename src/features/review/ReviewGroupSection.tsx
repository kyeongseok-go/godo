import type { ISODate, Settings, Task } from '../../domain/types'
import type { Lookups } from '../../hooks/lookups'
import type { ReviewGroup } from './actions'
import type { ReviewActionKind } from './actions'
import { ReviewItemRow } from './ReviewItemRow'

interface ReviewGroupSectionProps {
  group: ReviewGroup
  today: ISODate
  settings: Settings
  lookups: Lookups
  onAction: (taskId: string, kind: ReviewActionKind) => void
  onOpen: (task: Task) => void
  onToggleDone: (task: Task, done: boolean) => void
}

export function ReviewGroupSection({ group, ...rowProps }: ReviewGroupSectionProps) {
  return (
    <section className="rv-group" aria-labelledby={`rv-${group.reason}`}>
      <header className="rv-group__head">
        <h2 id={`rv-${group.reason}`} className="rv-group__title">
          {group.title}
          <sup className="rv-group__count">{group.items.length}</sup>
        </h2>
        <p className="rv-group__desc">{group.description}</p>
      </header>
      {group.items.map((item) => (
        <ReviewItemRow key={item.task.id} item={item} {...rowProps} />
      ))}
    </section>
  )
}
