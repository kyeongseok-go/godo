import { formatClock, spokenTime } from './clock'
import { KIND_LABEL, displayMs, elapsedMs, nextHint, progressOf } from './timer'
import type { PomodoroConfig, TimerState } from './timer'

const RADIUS = 128
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const STOPWATCH_LAP_MS = 60_000
const LONG_CLOCK_LENGTH = 5

interface TimerDialProps {
  timer: TimerState
  now: number
  config: PomodoroConfig
}

/** 링에 채울 비율. 스톱워치는 목표가 없으니 1분에 한 바퀴, 끝난 세션은 가득 채워 "끝남"을 보인다. */
function ringProgress(timer: TimerState, now: number, config: PomodoroConfig): number {
  if (timer.phase === 'finished') return 1
  if (timer.kind !== 'stopwatch') return progressOf(timer, now, config)
  if (timer.phase !== 'running' && timer.phase !== 'paused') return 0
  return (elapsedMs(timer, now) % STOPWATCH_LAP_MS) / STOPWATCH_LAP_MS
}

function captionOf(timer: TimerState, config: PomodoroConfig): string {
  if (timer.phase === 'finished') return nextHint(timer)
  if (timer.phase !== 'idle' || timer.kind === 'stopwatch') return ''
  return `${config.focusMin}분 집중 · ${config.shortBreakMin}분 휴식`
}

/** 큰 세리프 숫자와 SVG 진행 링. 링의 채움은 stroke-dashoffset 으로만 움직인다. */
export function TimerDial({ timer, now, config }: TimerDialProps) {
  const isCountdown = timer.kind !== 'stopwatch'
  const ms = displayMs(timer, now, config)
  const clock = formatClock(ms, isCountdown ? 'down' : 'up')
  const kindLabel = timer.phase === 'finished' ? `${KIND_LABEL[timer.kind]} 끝` : KIND_LABEL[timer.kind]
  const progress = ringProgress(timer, now, config)

  return (
    <div className="focus-dial" data-phase={timer.phase} data-kind={timer.kind}>
      <svg className="focus-dial__ring" viewBox="0 0 300 300" aria-hidden="true" focusable="false">
        <circle className="focus-dial__track" cx="150" cy="150" r={RADIUS} />
        <circle
          key={`${timer.kind}-${timer.startedAt}`}
          className="focus-dial__arc"
          cx="150"
          cy="150"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <div className="focus-dial__face">
        <p className="focus-dial__kind">
          {kindLabel}
          {timer.phase === 'paused' ? <span className="focus-dial__paused"> · 일시정지</span> : null}
        </p>
        <p
          className="focus-dial__time"
          role="timer"
          data-long={clock.length > LONG_CLOCK_LENGTH}
          aria-label={`${kindLabel}, ${isCountdown ? '남은 시간' : '경과 시간'} ${spokenTime(ms)}`}
        >
          {clock}
        </p>
        <p className="focus-dial__caption">{captionOf(timer, config)}</p>
      </div>
    </div>
  )
}
