import { Pause, Play, SkipForward, Square } from 'lucide-react'
import { KIND_LABEL } from './timer'
import type { TimerState } from './timer'

interface TimerControlsProps {
  timer: TimerState
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  onStop: () => void
}

function primaryAction(timer: TimerState, props: TimerControlsProps): { label: string; icon: 'play' | 'pause'; run: () => void } {
  switch (timer.phase) {
    case 'running':
      return { label: '일시정지', icon: 'pause', run: props.onPause }
    case 'paused':
      return { label: '이어서 하기', icon: 'play', run: props.onResume }
    case 'finished':
      return { label: `${timer.next ? KIND_LABEL[timer.next] : '다음'} 시작`, icon: 'play', run: props.onStart }
    default:
      return { label: '시작', icon: 'play', run: props.onStart }
  }
}

/** 시작·일시정지·재개는 하나의 큰 버튼. 건너뛰기·중단은 진행 중일 때만 보조로 나온다. */
export function TimerControls(props: TimerControlsProps) {
  const { timer } = props
  const primary = primaryAction(timer, props)
  const inSession = timer.phase === 'running' || timer.phase === 'paused'
  const canSkip = timer.kind !== 'stopwatch' && (inSession || (timer.phase === 'finished' && timer.next !== 'focus'))
  const canStop = inSession || timer.phase === 'finished'
  const stopLabel = timer.kind === 'stopwatch' && inSession ? '끝내고 기록' : timer.phase === 'finished' ? '끝내기' : '중단'
  const Icon = primary.icon === 'pause' ? Pause : Play

  return (
    <div className="focus-controls">
      <button type="button" className="focus-controls__primary" onClick={primary.run}>
        <Icon size={20} aria-hidden="true" />
        {primary.label}
      </button>
      <div className="focus-controls__secondary">
        {canSkip ? (
          <button type="button" className="focus-controls__ghost" onClick={props.onSkip}>
            <SkipForward size={16} aria-hidden="true" />
            건너뛰기
          </button>
        ) : null}
        {canStop ? (
          <button type="button" className="focus-controls__ghost" onClick={props.onStop}>
            <Square size={14} aria-hidden="true" />
            {stopLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
