import { Pencil } from 'lucide-react'
import type { CSSProperties } from 'react'
import { describeCountdownDate, describeRepeat } from './countdownView'
import type { CountdownEntry } from './countdownView'

const SOON_DAYS = 7

interface CountdownRowProps {
  entry: CountdownEntry
  hero?: boolean
  onEdit: () => void
}

/** 큰 세리프 숫자가 중심인 한 항목. 가까운 첫 항목(hero)은 더 크게 보여준다. */
export function CountdownRow({ entry, hero = false, onEdit }: CountdownRowProps) {
  const { countdown, info, nextDate } = entry
  const tone = info.passed ? 'passed' : info.daysLeft === 0 ? 'today' : info.daysLeft <= SOON_DAYS ? 'soon' : 'later'
  const repeat = describeRepeat(countdown.repeatYearly)

  return (
    <li className="cdrow" data-hero={hero} data-tone={tone} style={{ '--cd': countdown.color } as CSSProperties}>
      <p className="cdrow__num">{info.label}</p>
      <div className="cdrow__body">
        <h3 className="cdrow__name">
          <span className="cdrow__swatch" aria-hidden="true" />
          {countdown.name}
        </h3>
        <p className="cdrow__date">
          <time dateTime={nextDate}>{describeCountdownDate(nextDate)}</time>
          {repeat ? <span> · {repeat}</span> : null}
        </p>
      </div>
      <button type="button" className="icon-btn cdrow__edit" aria-label={`${countdown.name} 편집`} onClick={onEdit}>
        <Pencil size={16} aria-hidden="true" />
      </button>
    </li>
  )
}
