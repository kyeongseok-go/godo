import { Pause, Play, Square } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { paths } from '../../app/nav'
import { useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import { formatClock, spokenTime } from './clock'
import { useFocus } from './focusStore'
import { KIND_LABEL, displayMs, progressOf } from './timer'
import { useFocusClock } from './useFocusClock'
import './focus-mini.css'

/** 타이머가 돌고 있을 때만 화면 아래에 떠서 남은 시간과 조작 버튼을 보여준다. 누르면 집중 화면으로 간다. */
export function FocusMini() {
  const timer = useFocus((s) => s.timer)
  const pause = useFocus((s) => s.pause)
  const resume = useFocus((s) => s.resume)
  const stop = useFocus((s) => s.stop)
  const config = useSettings().pomodoro
  const taskTitle = useApp((s) => (timer.taskId ? (s.entities.tasks[timer.taskId]?.title ?? null) : null))
  const now = useFocusClock()
  const { pathname } = useLocation()

  const isPaused = timer.phase === 'paused'
  const isActive = timer.phase === 'running' || isPaused
  // 집중 화면에는 같은 정보가 이미 크게 있으니 겹쳐 띄우지 않는다.
  if (!isActive || pathname === paths.focus) return null

  const isStopwatch = timer.kind === 'stopwatch'
  const ms = displayMs(timer, now, config)
  const clock = formatClock(ms, isStopwatch ? 'up' : 'down')
  const kind = KIND_LABEL[timer.kind]
  const name = taskTitle ?? '이름 없는 세션'
  const ToggleIcon = isPaused ? Play : Pause

  return (
    <aside className="focus-mini" data-kind={timer.kind} data-paused={isPaused} aria-label="집중 타이머">
      <span className="focus-mini__progress" style={{ transform: `scaleX(${progressOf(timer, now, config)})` }} aria-hidden="true" />
      <Link
        to={paths.focus}
        className="focus-mini__body"
        aria-label={`집중 화면으로 이동. ${kind} ${spokenTime(ms)} ${isStopwatch ? '경과' : '남음'}${isPaused ? ', 일시정지 중' : ''}. ${name}`}
      >
        <span className="focus-mini__kind">
          {kind}
          {isPaused ? ' · 일시정지' : ''}
        </span>
        <span className="focus-mini__time">{clock}</span>
        <span className="focus-mini__task">{name}</span>
      </Link>
      <button
        type="button"
        className="focus-mini__btn"
        aria-label={isPaused ? '이어서 하기' : '일시정지'}
        onClick={isPaused ? resume : pause}
      >
        <ToggleIcon size={18} aria-hidden="true" />
      </button>
      <button type="button" className="focus-mini__btn" aria-label={isStopwatch ? '끝내고 기록' : '중단'} onClick={stop}>
        <Square size={16} aria-hidden="true" />
      </button>
    </aside>
  )
}
