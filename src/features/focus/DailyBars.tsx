import { useId } from 'react'
import { fromISODate } from '../../domain/date'
import type { ISODate } from '../../domain/types'
import { formatDuration } from '../../domain/format'
import type { DailyBar } from './statsData'

const COLUMN = 24
const BAR_WIDTH = 14
const TOP = 20
const BASELINE = 124
const PLOT_HEIGHT = BASELINE - TOP
const MIN_SCALE_MIN = 60
const STUB_HEIGHT = 2

interface DailyBarsProps {
  bars: readonly DailyBar[]
  today: ISODate
}

function shortDate(date: ISODate): string {
  const d = fromISODate(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function longDate(date: ISODate): string {
  const d = fromISODate(date)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 날짜 글자는 처음·가운데·끝에만 붙인다. 가장자리 글자는 안쪽으로 정렬해 잘리지 않게 한다. */
function labelSpot(index: number, last: number): 'start' | 'middle' | 'end' | null {
  if (index === 0) return 'start'
  if (index === last) return 'end'
  return index === Math.floor(last / 2) ? 'middle' : null
}

/** 최근 며칠의 집중 시간 막대. SVG 로 직접 그리고, 같은 값을 표로도 제공한다. */
export function DailyBars({ bars, today }: DailyBarsProps) {
  const uid = useId()
  const width = bars.length * COLUMN
  const maxMin = Math.max(MIN_SCALE_MIN, ...bars.map((b) => b.min))
  const peak = bars.reduce((best, b) => (b.min > best.min ? b : best), bars[0] ?? { date: today, min: 0 })
  const total = bars.reduce((sum, b) => sum + b.min, 0)
  const summary = `최근 ${bars.length}일 집중 시간 막대 그래프. 합계 ${formatDuration(total)}.`

  return (
    <figure className="focus-bars">
      <svg viewBox={`0 0 ${width} 150`} role="img" aria-labelledby={`${uid}-title ${uid}-desc`} focusable="false">
        <title id={`${uid}-title`}>{`최근 ${bars.length}일 집중 시간`}</title>
        <desc id={`${uid}-desc`}>{summary}</desc>
        <line className="focus-bars__base" x1="0" x2={width} y1={BASELINE} y2={BASELINE} />
        {bars.map((bar, i) => {
          const height = bar.min === 0 ? STUB_HEIGHT : Math.max(STUB_HEIGHT, (bar.min / maxMin) * PLOT_HEIGHT)
          const x = i * COLUMN + (COLUMN - BAR_WIDTH) / 2
          const isToday = bar.date === today
          const spot = labelSpot(i, bars.length - 1)
          const showValue = bar.min > 0 && (isToday || (bar.date === peak.date && peak.min > 0))
          return (
            <g key={bar.date}>
              <rect
                className="focus-bars__bar"
                data-today={isToday}
                data-empty={bar.min === 0}
                x={x}
                y={BASELINE - height}
                width={BAR_WIDTH}
                height={height}
              >
                <title>{`${longDate(bar.date)} ${formatDuration(bar.min)}`}</title>
              </rect>
              {showValue ? (
                <text className="focus-bars__value" x={x + BAR_WIDTH / 2} y={BASELINE - height - 5} textAnchor="middle">
                  {bar.min}
                </text>
              ) : null}
              {spot ? (
                <text
                  className="focus-bars__label"
                  x={spot === 'start' ? x : spot === 'end' ? x + BAR_WIDTH : x + BAR_WIDTH / 2}
                  y={BASELINE + 18}
                  textAnchor={spot}
                >
                  {shortDate(bar.date)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption className="sr-only">{summary}</figcaption>
      <table className="sr-only">
        <caption>{`최근 ${bars.length}일 집중 시간(분)`}</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">집중 시간</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.date}>
              <th scope="row">{longDate(bar.date)}</th>
              <td>{formatDuration(bar.min)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
