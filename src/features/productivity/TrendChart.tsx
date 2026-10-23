import { useId, useMemo } from 'react'
import type { ISODate, Weekday } from '../../domain/types'
import { axisLabelIndices, buildTrend, describeTrendBar } from './chart'
import type { TrendBar, TrendChart as TrendGeometry } from './chart'
import './trend.css'
import { useElementWidth } from './useElementWidth'
import { useTrendActive } from './useTrendActive'

interface TrendChartProps {
  series: readonly { date: ISODate; done: number }[]
  dailyGoal: number
  daysOff: readonly Weekday[]
  today: ISODate
}

const FALLBACK_WIDTH = 640
const NARROW_WIDTH = 480
const TALL_HEIGHT = 224
const SHORT_HEIGHT = 184
const WIDE_LABEL_STEP = 7
const NARROW_LABEL_STEP = 10
const TOOLTIP_HALF_WIDTH = 96

const shortDate = (date: ISODate): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

function Axes({ chart, width, goal, showGoalLabel }: { chart: TrendGeometry; width: number; goal: number; showGoalLabel: boolean }) {
  const labelAt = chart.plotLeft - 6
  return (
    <g className="prod-trend__axes" aria-hidden="true">
      <line className="prod-trend__grid" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.plotTop} y2={chart.plotTop} />
      <text className="prod-trend__tick" x={labelAt} y={chart.plotTop + 4} textAnchor="end">{chart.max}</text>
      <text className="prod-trend__tick" x={labelAt} y={chart.plotBottom + 4} textAnchor="end">0</text>
      <line className="prod-trend__goal" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.goalY} y2={chart.goalY} />
      {showGoalLabel ? (
        <text className="prod-trend__goal-label" x={Math.min(chart.plotRight, width - 2)} y={chart.goalY - 5} textAnchor="end">
          목표 {goal}
        </text>
      ) : null}
      <line className="prod-trend__base" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.plotBottom} y2={chart.plotBottom} />
    </g>
  )
}

function Bars({ bars, activeIndex }: { bars: readonly TrendBar[]; activeIndex: number | null }) {
  return (
    <g aria-hidden="true">
      {bars.map((bar) => (
        <g key={bar.date}>
          {bar.index === activeIndex ? (
            <rect className="prod-trend__active" x={bar.slotX} width={bar.slotWidth} y={0} height="100%" />
          ) : null}
          {bar.height > 0 ? (
            <rect
              className="prod-trend__bar"
              data-off={bar.isOff}
              data-today={bar.isToday}
              style={{ ['--i' as string]: bar.index }}
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
            />
          ) : null}
        </g>
      ))}
    </g>
  )
}

function DateLabels({ chart, step }: { chart: TrendGeometry; step: number }) {
  const { bars } = chart
  return (
    <g aria-hidden="true">
      {axisLabelIndices(bars.length, step).map((index) => (
        <text
          key={bars[index].date}
          className="prod-trend__tick"
          data-today={bars[index].isToday}
          x={bars[index].slotX + bars[index].slotWidth / 2}
          y={chart.plotBottom + 18}
          textAnchor="middle"
        >
          {bars[index].isToday ? '오늘' : shortDate(bars[index].date)}
        </text>
      ))}
    </g>
  )
}

/** 같은 데이터를 스크린 리더용 표로도 내보낸다 */
function DataTable({ bars, goal }: { bars: readonly TrendBar[]; goal: number }) {
  return (
    <table className="sr-only">
      <caption>최근 {bars.length}일 일별 완료 건수</caption>
      <thead>
        <tr><th scope="col">날짜</th><th scope="col">완료 건수</th><th scope="col">비고</th></tr>
      </thead>
      <tbody>
        {bars.map((bar) => (
          <tr key={bar.date}>
            <th scope="row">{bar.date}</th>
            <td>{bar.done}</td>
            <td>{[bar.isOff ? '쉬는 날' : '', bar.isToday ? '오늘' : '', bar.done >= goal ? '목표 달성' : ''].filter(Boolean).join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Tooltip({ id, bar, goal, width }: { id: string; bar: TrendBar | undefined; goal: number; width: number }) {
  const left = bar ? Math.min(width - TOOLTIP_HALF_WIDTH, Math.max(TOOLTIP_HALF_WIDTH, bar.slotX + bar.slotWidth / 2)) : 0
  return (
    <div className="prod-trend__tooltip" id={id} role="status" style={{ left }} data-visible={bar !== undefined}>
      {bar ? describeTrendBar(bar, goal) : ''}
    </div>
  )
}

/** 최근 N일 완료 건수 막대 그래프. 가로폭에 맞춰 직접 그린 SVG 이고, 호버·키보드로 값을 읽을 수 있다. */
export function TrendChart({ series, dailyGoal, daysOff, today }: TrendChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(FALLBACK_WIDTH)
  const tooltipId = useId()
  const narrow = width < NARROW_WIDTH
  const height = narrow ? SHORT_HEIGHT : TALL_HEIGHT
  const goal = Math.max(1, dailyGoal)
  const chart = useMemo(
    () => buildTrend({ series, dailyGoal, daysOff, today, width, height }),
    [series, dailyGoal, daysOff, today, width, height],
  )
  const { activeIndex, svgHandlers, groupHandlers } = useTrendActive(chart)

  return (
    <div className="prod-trend" ref={wrapRef}>
      <Tooltip id={tooltipId} bar={activeIndex === null ? undefined : chart.bars[activeIndex]} goal={goal} width={width} />
      <div
        className="prod-trend__focus"
        role="group"
        tabIndex={0}
        aria-label="최근 30일 완료 추이 막대 그래프. 좌우 방향키로 날짜를 옮겨 값을 읽어요."
        aria-describedby={tooltipId}
        {...groupHandlers}
      >
        <svg className="prod-trend__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} focusable="false" {...svgHandlers}>
          <Axes chart={chart} width={width} goal={goal} showGoalLabel={!narrow} />
          <Bars bars={chart.bars} activeIndex={activeIndex} />
          <DateLabels chart={chart} step={narrow ? NARROW_LABEL_STEP : WIDE_LABEL_STEP} />
        </svg>
      </div>
      <DataTable bars={chart.bars} goal={goal} />
    </div>
  )
}
