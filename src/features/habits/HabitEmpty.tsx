import { Plus } from 'lucide-react'
import { HABIT_EXAMPLES } from './habitDraft'
import type { HabitExample } from './habitDraft'

interface HabitEmptyProps {
  onPick: (example: HabitExample) => void
  onCreate: () => void
}

/** 습관이 하나도 없을 때. 예시 칩을 누르면 오늘부터 시작하는 습관이 바로 만들어진다. */
export function HabitEmpty({ onPick, onCreate }: HabitEmptyProps) {
  return (
    <section className="hempty" aria-labelledby="habit-empty-title">
      <p className="hempty__big" aria-hidden="true">
        0<span>일째</span>
      </p>
      <div className="hempty__body">
        <h2 id="habit-empty-title">첫 습관을 하나만 골라 보세요</h2>
        <p>작게 시작할수록 오래 가요. 아래 예시를 누르면 오늘부터 바로 기록할 수 있어요.</p>
        <ul className="hempty__chips" aria-label="예시 습관">
          {HABIT_EXAMPLES.map((example) => (
            <li key={example.name}>
              <button type="button" className="hchip" style={{ '--habit': example.color } as React.CSSProperties} onClick={() => onPick(example)}>
                <span className="hrow__dot" aria-hidden="true" />
                {example.name}
                <small>{example.goal.kind === 'count' ? `${example.goal.target}${example.goal.unit ?? ''}` : '체크'}</small>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-ghost" onClick={onCreate}>
          <Plus size={15} aria-hidden="true" /> 직접 만들기
        </button>
      </div>
    </section>
  )
}
