import { useMemo } from 'react'
import { focusSummary } from '../../domain/stats'
import { useSettings, useTable } from '../../hooks/data'
import { formatClock } from './clock'
import { buildDots } from './statsData'
import { useFocus } from './focusStore'
import { KIND_LABEL, displayMs, modeOf, nextHint } from './timer'
import type { PomodoroConfig, TimerMode, TimerState } from './timer'
import { TaskPicker } from './TaskPicker'
import { TimerControls } from './TimerControls'
import { TimerDial } from './TimerDial'
import { useDocumentTitle } from './useDocumentTitle'
import { useCalendarToday, useFocusClock } from './useFocusClock'

const MODES: ReadonlyArray<{ mode: TimerMode; label: string }> = [
  { mode: 'pomodoro', label: '포모도로' },
  { mode: 'stopwatch', label: '스톱워치' },
]

/** 화면 낭독기에 알릴 상태 변화. 숫자는 매 초 읽지 않고 단계가 바뀔 때만 알린다. */
function announcementOf(timer: TimerState): string {
  switch (timer.phase) {
    case 'running':
      return `${KIND_LABEL[timer.kind]} 진행 중`
    case 'paused':
      return '일시정지했어요'
    case 'finished':
      return `${KIND_LABEL[timer.kind]}이 끝났어요. ${nextHint(timer)}`
    default:
      return ''
  }
}

function titleOf(timer: TimerState, now: number, config: PomodoroConfig): string | null {
  if (timer.phase === 'idle' || timer.phase === 'finished') return null
  const clock = formatClock(displayMs(timer, now, config), timer.kind === 'stopwatch' ? 'up' : 'down')
  return `${clock} ${KIND_LABEL[timer.kind]}${timer.phase === 'paused' ? ' (일시정지)' : ''}`
}

function TodayDots({ cycle }: { cycle: number }) {
  const sessions = useTable('focusSessions')
  const today = useCalendarToday()
  const doneToday = useMemo(
    () => focusSummary(sessions.filter((s) => s.kind === 'pomodoro'), today).todayCount,
    [sessions, today],
  )
  const dots = buildDots(doneToday, cycle)

  return (
    <div className="focus-dots">
      <div className="focus-dots__row" role="img" aria-label={`오늘 완료한 포모 ${dots.done}개`}>
        {Array.from({ length: dots.total }, (_, i) => (
          <span key={i} className="focus-dots__dot" data-done={i < dots.done} />
        ))}
      </div>
      <p className="focus-dots__label">
        오늘 <strong>{dots.done}</strong>포모
      </p>
    </div>
  )
}

export function TimerStage() {
  const timer = useFocus((s) => s.timer)
  const start = useFocus((s) => s.start)
  const pause = useFocus((s) => s.pause)
  const resume = useFocus((s) => s.resume)
  const skip = useFocus((s) => s.skip)
  const stop = useFocus((s) => s.stop)
  const setMode = useFocus((s) => s.setMode)
  const setTask = useFocus((s) => s.setTask)
  const config = useSettings().pomodoro
  const now = useFocusClock()
  const canSwitchMode = timer.phase === 'idle' || timer.phase === 'finished'

  useDocumentTitle(titleOf(timer, now, config))

  return (
    <section className="focus-stage" aria-label="집중 타이머">
      <div className="focus-mode" role="group" aria-label="타이머 방식">
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className="focus-mode__button"
            aria-pressed={modeOf(timer) === mode}
            disabled={!canSwitchMode && modeOf(timer) !== mode}
            onClick={() => setMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <TimerDial timer={timer} now={now} config={config} />
      <p className="sr-only" role="status">
        {announcementOf(timer)}
      </p>

      <TimerControls timer={timer} onStart={start} onPause={pause} onResume={resume} onSkip={skip} onStop={stop} />
      <TaskPicker taskId={timer.taskId} onChange={setTask} />
      {modeOf(timer) === 'pomodoro' ? <TodayDots cycle={config.longBreakEvery} /> : null}
    </section>
  )
}
