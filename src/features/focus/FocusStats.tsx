import { useMemo } from 'react'
import { formatDuration } from '../../domain/format'
import { focusSummary } from '../../domain/stats'
import { useTable } from '../../hooks/data'
import { DailyBars } from './DailyBars'
import { buildDailyBars, buildTopTasks } from './statsData'
import { useCalendarToday } from './useFocusClock'

const WINDOW_DAYS = 14
const TOP_TASK_LIMIT = 5

export function FocusStats() {
  const sessions = useTable('focusSessions')
  const tasks = useTable('tasks')
  const today = useCalendarToday()

  const summary = useMemo(() => focusSummary(sessions, today), [sessions, today])
  const bars = useMemo(() => buildDailyBars(summary.byDay, today, WINDOW_DAYS), [summary, today])
  const top = useMemo(
    () => buildTopTasks(summary.byTask, new Map(tasks.map((t) => [t.id, t])), TOP_TASK_LIMIT),
    [summary, tasks],
  )
  const longest = top.items[0]?.min ?? 1

  return (
    <section className="focus-stats" aria-labelledby="focus-stats-title">
      <h2 className="focus-side-title" id="focus-stats-title">
        집중 기록
      </h2>

      <dl className="focus-totals">
        <div className="focus-totals__cell">
          <dt>오늘</dt>
          <dd>
            <strong>{formatDuration(summary.todayMin)}</strong>
            <span>{summary.todayCount}회</span>
          </dd>
        </div>
        <div className="focus-totals__cell">
          <dt>전체</dt>
          <dd>
            <strong>{formatDuration(summary.totalMin)}</strong>
            <span>{summary.totalCount}회</span>
          </dd>
        </div>
      </dl>

      {summary.totalCount === 0 ? (
        <p className="focus-stats__empty">아직 기록이 없어요. 첫 집중을 끝내면 여기에 쌓여요.</p>
      ) : null}

      <DailyBars bars={bars} today={today} />

      <h3 className="focus-stats__sub">할 일별 집중 시간</h3>
      {top.items.length > 0 ? (
        <ol className="focus-rank">
          {top.items.map((item, i) => (
            <li key={item.taskId} className="focus-rank__row">
              <span className="focus-rank__no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="focus-rank__title">{item.title}</span>
              <span className="focus-rank__min">{formatDuration(item.min)}</span>
              <span className="focus-rank__bar" aria-hidden="true">
                <span style={{ inlineSize: `${Math.max(4, (item.min / longest) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="focus-stats__empty">할 일을 연결해 집중하면 어디에 시간을 썼는지 보여요.</p>
      )}
      {top.unlinkedMin > 0 ? <p className="focus-stats__note">연결 없는 세션 {formatDuration(top.unlinkedMin)}</p> : null}
    </section>
  )
}
