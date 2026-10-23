import type { CSSProperties } from 'react'
import type { Habit, ISODate } from '../../domain/types'
import { formatMonthDay, habitHeatmap } from './habitView'

const CELL = 14
const GAP = 3
const LEFT = 20
const TOP = 16
const STEP = CELL + GAP
const WEEKDAY_LABEL_ROWS = [0, 2, 4] // 한 줄 건너 요일을 적는다(월요일 시작이면 월·수·금)
const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']

interface HeatmapProps {
  habit: Habit
  today: ISODate
  weeks: number
  weekStartsOn: 0 | 1
}

/** 최근 N주 달성 히트맵. 농도는 목표 대비 진행도이고, 칸마다 <title> 로 날짜와 값을 읽을 수 있다. */
export function Heatmap({ habit, today, weeks, weekStartsOn }: HeatmapProps) {
  const grid = habitHeatmap(habit, today, weeks, weekStartsOn)
  const width = LEFT + weeks * STEP - GAP
  const height = TOP + 7 * STEP - GAP
  const logged = grid.flat().filter((c) => c.level > 0).length
  const monthOf = (date: ISODate): number => Number(date.slice(5, 7))

  return (
    <svg
      className="heat"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`최근 ${weeks}주 동안 ${logged}일 기록했어요`}
      style={{ '--habit': habit.color } as CSSProperties}
    >
      {grid.map((week, w) => {
        const prev = grid[w - 1]?.[0]
        const showMonth = !prev || monthOf(prev.date) !== monthOf(week[0].date)
        return showMonth ? (
          <text key={week[0].date} className="heat__label" x={LEFT + w * STEP} y={10}>
            {monthOf(week[0].date)}월
          </text>
        ) : null
      })}
      {WEEKDAY_LABEL_ROWS.map((row) => (
        <text key={row} className="heat__label" x={0} y={TOP + row * STEP + CELL - 3}>
          {WEEKDAY_SHORT[(row + weekStartsOn) % 7]}
        </text>
      ))}
      {grid.map((week, w) =>
        week.map((cell, d) =>
          cell.future ? null : (
            <rect
              key={cell.date}
              className="heat__cell"
              data-level={cell.level}
              data-due={cell.due}
              x={LEFT + w * STEP}
              y={TOP + d * STEP}
              width={CELL}
              height={CELL}
              rx={2}
            >
              <title>{`${formatMonthDay(cell.date)} · ${cell.level === 4 ? '달성' : cell.level > 0 ? '일부 달성' : cell.due ? '기록 없음' : '쉬는 날'}`}</title>
            </rect>
          ),
        ),
      )}
    </svg>
  )
}
