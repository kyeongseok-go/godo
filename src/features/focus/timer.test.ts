import type { Settings } from '../../domain/types'
import {
  createTimer,
  displayMs,
  durationMs,
  elapsedMs,
  isDue,
  modeOf,
  nextHint,
  pauseTimer,
  progressOf,
  resumeTimer,
  setMode,
  setTask,
  skipTimer,
  startTimer,
  stopTimer,
  tickTimer,
} from './timer'
import type { TimerState } from './timer'

const MIN = 60_000
const T0 = 1_700_000_000_000

const CFG: Settings['pomodoro'] = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStart: false,
  sound: true,
}
const AUTO: Settings['pomodoro'] = { ...CFG, autoStart: true }

function running(at = T0, cfg = CFG): TimerState {
  return startTimer(createTimer(), at, cfg)
}

/** 집중 한 번을 끝까지 돌려 finished 상태를 돌려준다. */
function finishFocus(state: TimerState, at: number, cfg = CFG): { state: TimerState; at: number } {
  const started = startTimer(state, at, cfg)
  const end = at + 25 * MIN
  return { state: tickTimer(started, end, cfg).state, at: end }
}

describe('timer: start and elapsed time', () => {
  test('starts idle in focus mode', () => {
    const s = createTimer()
    expect(s.phase).toBe('idle')
    expect(s.kind).toBe('focus')
    expect(modeOf(s)).toBe('pomodoro')
  })

  test('start moves idle to running with the configured target', () => {
    const s = running()
    expect(s.phase).toBe('running')
    expect(s.targetMs).toBe(25 * MIN)
    expect(s.startedAt).toBe(T0)
    expect(elapsedMs(s, T0 + 10 * MIN)).toBe(10 * MIN)
  })

  test('start is ignored while already running or paused', () => {
    const s = running()
    expect(startTimer(s, T0 + MIN, CFG)).toBe(s)
    const p = pauseTimer(s, T0 + MIN)
    expect(startTimer(p, T0 + 2 * MIN, CFG)).toBe(p)
  })

  test('computes from timestamps, so skipped ticks do not lose time', () => {
    // 탭이 20분 동안 백그라운드에 있어 틱이 한 번도 없었던 상황
    const s = running()
    expect(elapsedMs(s, T0 + 20 * MIN)).toBe(20 * MIN)
    expect(displayMs(s, T0 + 20 * MIN, CFG)).toBe(5 * MIN)
  })

  test('elapsed never goes negative when the clock moves backwards', () => {
    const s = running()
    expect(elapsedMs(s, T0 - 5 * MIN)).toBe(0)
  })

  test('elapsed is capped at the target while a due tick is pending', () => {
    const s = running()
    expect(elapsedMs(s, T0 + 90 * MIN)).toBe(25 * MIN)
    expect(displayMs(s, T0 + 90 * MIN, CFG)).toBe(0)
  })
})

describe('timer: pause and resume', () => {
  test('time does not pass while paused', () => {
    const paused = pauseTimer(running(), T0 + 10 * MIN)
    expect(paused.phase).toBe('paused')
    expect(elapsedMs(paused, T0 + 10 * MIN)).toBe(10 * MIN)
    expect(elapsedMs(paused, T0 + 3 * 60 * MIN)).toBe(10 * MIN)
  })

  test('resume continues from the accumulated time', () => {
    const paused = pauseTimer(running(), T0 + 10 * MIN)
    const resumed = resumeTimer(paused, T0 + 40 * MIN)
    expect(resumed.phase).toBe('running')
    expect(elapsedMs(resumed, T0 + 45 * MIN)).toBe(15 * MIN)
  })

  test('accumulates across several pause and resume cycles', () => {
    let s = running()
    s = pauseTimer(s, T0 + 5 * MIN)
    s = resumeTimer(s, T0 + 20 * MIN)
    s = pauseTimer(s, T0 + 25 * MIN)
    s = resumeTimer(s, T0 + 60 * MIN)
    expect(elapsedMs(s, T0 + 70 * MIN)).toBe(20 * MIN)
  })

  test('a paused timer never completes on tick, however late', () => {
    const paused = pauseTimer(running(), T0 + 24 * MIN)
    const out = tickTimer(paused, T0 + 500 * MIN, CFG)
    expect(out.ended).toBeNull()
    expect(out.state).toBe(paused)
  })

  test('pause, resume and tick are no-ops in the wrong phase', () => {
    const idle = createTimer()
    expect(pauseTimer(idle, T0)).toBe(idle)
    expect(resumeTimer(idle, T0)).toBe(idle)
    const r = running()
    expect(resumeTimer(r, T0 + MIN)).toBe(r)
    expect(tickTimer(idle, T0, CFG).ended).toBeNull()
  })

  test('pause right after the target passed is ignored so the pending completion is not lost', () => {
    const s = running()
    expect(pauseTimer(s, T0 + 26 * MIN)).toBe(s)
    expect(tickTimer(s, T0 + 26 * MIN, CFG).ended?.reason).toBe('elapsed')
  })
})

describe('timer: completion', () => {
  test('is not due one millisecond before the target and is due exactly at it', () => {
    const s = running()
    expect(isDue(s, T0 + 25 * MIN - 1)).toBe(false)
    expect(tickTimer(s, T0 + 25 * MIN - 1, CFG).ended).toBeNull()
    expect(isDue(s, T0 + 25 * MIN)).toBe(true)
  })

  test('finishing a focus saves a completed pomodoro record and offers a short break', () => {
    const out = tickTimer(running(T0), T0 + 25 * MIN, CFG)
    expect(out.ended).toEqual({
      kind: 'focus',
      reason: 'elapsed',
      endedAt: T0 + 25 * MIN,
      record: { kind: 'pomodoro', taskId: null, startedAt: T0, durationSec: 1500, completed: true },
    })
    expect(out.state.phase).toBe('finished')
    expect(out.state.next).toBe('shortBreak')
    expect(out.state.focusDone).toBe(1)
    expect(nextHint(out.state)).toBe('다음: 짧은 휴식')
  })

  test('a very late tick still records only the configured length', () => {
    const out = tickTimer(running(T0), T0 + 3 * 60 * MIN, CFG)
    expect(out.ended?.record?.durationSec).toBe(1500)
    expect(out.ended?.endedAt).toBe(T0 + 25 * MIN)
  })

  test('a pause in the middle shifts the end time', () => {
    let s = running(T0)
    s = pauseTimer(s, T0 + 10 * MIN)
    s = resumeTimer(s, T0 + 30 * MIN)
    expect(tickTimer(s, T0 + 44 * MIN, CFG).ended).toBeNull()
    const out = tickTimer(s, T0 + 45 * MIN, CFG)
    expect(out.ended?.endedAt).toBe(T0 + 45 * MIN)
    expect(out.ended?.record?.startedAt).toBe(T0)
  })

  test('links the record to the selected task', () => {
    const s = setTask(running(T0), 'task-1')
    expect(tickTimer(s, T0 + 25 * MIN, CFG).ended?.record?.taskId).toBe('task-1')
  })

  test('every Nth completed focus is followed by a long break', () => {
    let state = createTimer()
    let at = T0
    const nexts: Array<TimerState['next']> = []
    for (let i = 0; i < 4; i += 1) {
      const done = finishFocus(state, at)
      nexts.push(done.state.next)
      // 휴식을 끝까지 거쳐 다음 집중으로 돌아간다.
      const brk = startTimer(done.state, done.at, CFG)
      const brkEnd = done.at + (brk.targetMs ?? 0)
      state = tickTimer(brk, brkEnd, CFG).state
      at = brkEnd
    }
    expect(nexts).toEqual(['shortBreak', 'shortBreak', 'shortBreak', 'longBreak'])
    expect(state.next).toBe('focus')
  })

  test('a break ends without a record and offers the next focus', () => {
    const afterFocus = finishFocus(createTimer(), T0)
    const brk = startTimer(afterFocus.state, afterFocus.at, CFG)
    expect(brk.kind).toBe('shortBreak')
    expect(brk.targetMs).toBe(5 * MIN)
    const out = tickTimer(brk, afterFocus.at + 5 * MIN, CFG)
    expect(out.ended?.record).toBeNull()
    expect(out.ended?.kind).toBe('shortBreak')
    expect(out.state.next).toBe('focus')
    expect(nextHint(out.state)).toBe('다음: 집중')
  })

  test('long break uses its own length', () => {
    const cfg = { ...CFG, longBreakEvery: 1 }
    const done = finishFocus(createTimer(), T0, cfg)
    expect(done.state.next).toBe('longBreak')
    expect(startTimer(done.state, done.at, cfg).targetMs).toBe(15 * MIN)
  })

  test('auto start begins the next session at the exact end time when the tick is only slightly late', () => {
    const out = tickTimer(running(T0, AUTO), T0 + 25 * MIN + 2_000, AUTO)
    expect(out.ended?.record?.completed).toBe(true)
    expect(out.state.phase).toBe('running')
    expect(out.state.kind).toBe('shortBreak')
    expect(out.state.runningSince).toBe(T0 + 25 * MIN)
    expect(elapsedMs(out.state, T0 + 25 * MIN + 2_000)).toBe(2_000)
  })

  test('auto start begins from now when the tab slept for a long time', () => {
    const late = T0 + 5 * 60 * MIN
    const out = tickTimer(running(T0, AUTO), late, AUTO)
    expect(out.state.phase).toBe('running')
    expect(out.state.runningSince).toBe(late)
    expect(elapsedMs(out.state, late)).toBe(0)
  })

  test('start from finished begins the offered session and keeps the task', () => {
    const linked = setTask(running(T0), 't1')
    const finished = tickTimer(linked, T0 + 25 * MIN, CFG).state
    const next = startTimer(finished, T0 + 26 * MIN, CFG)
    expect(next.phase).toBe('running')
    expect(next.kind).toBe('shortBreak')
    expect(next.taskId).toBe('t1')
    expect(next.focusDone).toBe(1)
  })

  test('invalid settings fall back to at least one minute', () => {
    expect(durationMs('focus', { ...CFG, focusMin: 0 })).toBe(MIN)
    expect(durationMs('focus', { ...CFG, focusMin: Number.NaN })).toBe(MIN)
    expect(durationMs('stopwatch', CFG)).toBeNull()
  })
})

describe('timer: skip', () => {
  test('skipping a focus keeps the partial time as an incomplete record and does not count it', () => {
    const out = skipTimer(running(T0), T0 + 10 * MIN, CFG)
    expect(out.ended).toMatchObject({
      reason: 'skipped',
      record: { kind: 'pomodoro', durationSec: 600, completed: false },
    })
    expect(out.state.phase).toBe('finished')
    expect(out.state.next).toBe('shortBreak')
    expect(out.state.focusDone).toBe(0)
  })

  test('skipping a focus after only seconds saves nothing', () => {
    const out = skipTimer(running(T0), T0 + 10_000, CFG)
    expect(out.ended?.record).toBeNull()
    expect(out.state.next).toBe('shortBreak')
  })

  test('skipping a paused session works and uses the accumulated time', () => {
    const paused = pauseTimer(running(T0), T0 + 8 * MIN)
    const out = skipTimer(paused, T0 + 90 * MIN, CFG)
    expect(out.ended?.record?.durationSec).toBe(480)
  })

  test('skipping a break goes straight to the next focus', () => {
    const brk = startTimer(finishFocus(createTimer(), T0).state, T0 + 26 * MIN, CFG)
    const out = skipTimer(brk, T0 + 27 * MIN, CFG)
    expect(out.ended?.record).toBeNull()
    expect(out.state.next).toBe('focus')
  })

  test('skipping the offered break moves on to the next focus', () => {
    const finished = finishFocus(createTimer(), T0).state
    const out = skipTimer(finished, T0 + 26 * MIN, CFG)
    expect(out.ended).toBeNull()
    expect(out.state.phase).toBe('finished')
    expect(out.state.next).toBe('focus')
  })

  test('skipping the offered break with auto start starts a focus immediately', () => {
    const finished = finishFocus(createTimer(), T0, AUTO).state
    expect(finished.phase).toBe('running')
    const brk = skipTimer(finished, T0 + 26 * MIN, AUTO)
    expect(brk.state.phase).toBe('running')
    expect(brk.state.kind).toBe('focus')
  })

  test('skip is a no-op when idle or when the next session is already a focus', () => {
    const idle = createTimer()
    expect(skipTimer(idle, T0, CFG).state).toBe(idle)
    const afterBreak = skipTimer(finishFocus(createTimer(), T0).state, T0, CFG).state
    expect(skipTimer(afterBreak, T0, CFG).state).toBe(afterBreak)
  })

  test('skipping a session that is already due completes it normally', () => {
    const out = skipTimer(running(T0), T0 + 26 * MIN, CFG)
    expect(out.ended).toMatchObject({ reason: 'elapsed', record: { completed: true, durationSec: 1500 } })
    expect(out.state.focusDone).toBe(1)
  })

  test('skipping the stopwatch ends it like stop', () => {
    const sw = startTimer(setMode(createTimer(), 'stopwatch'), T0, CFG)
    const out = skipTimer(sw, T0 + 12 * MIN, CFG)
    expect(out.state.phase).toBe('idle')
    expect(out.ended?.record).toMatchObject({ kind: 'stopwatch', completed: true, durationSec: 720 })
  })
})

describe('timer: stop', () => {
  test('stopping a focus early saves an incomplete record and resets the cycle', () => {
    const afterOne = startTimer(finishFocus(createTimer(), T0).state, T0 + 30 * MIN, CFG)
    const focusAgain = startTimer(skipTimer(afterOne, T0 + 31 * MIN, CFG).state, T0 + 31 * MIN, CFG)
    const out = stopTimer(focusAgain, T0 + 41 * MIN)
    expect(out.ended).toMatchObject({ reason: 'stopped', record: { completed: false, durationSec: 600 } })
    expect(out.state).toEqual(createTimer())
  })

  test('stopping a break saves nothing', () => {
    const brk = startTimer(finishFocus(createTimer(), T0).state, T0 + 26 * MIN, CFG)
    const out = stopTimer(brk, T0 + 27 * MIN)
    expect(out.ended?.record).toBeNull()
    expect(out.state.phase).toBe('idle')
    expect(out.state.kind).toBe('focus')
  })

  test('stopping a focus within seconds saves nothing', () => {
    expect(stopTimer(running(T0), T0 + 5_000).ended?.record).toBeNull()
  })

  test('stopping the stopwatch saves a completed stopwatch record', () => {
    const sw = pauseTimer(startTimer(setMode(createTimer(), 'stopwatch'), T0, CFG), T0 + 3 * MIN)
    const out = stopTimer(sw, T0 + 9 * MIN)
    expect(out.ended?.record).toEqual({
      kind: 'stopwatch',
      taskId: null,
      startedAt: T0,
      durationSec: 180,
      completed: true,
    })
    expect(out.state.kind).toBe('stopwatch')
    expect(out.state.phase).toBe('idle')
  })

  test('stopping an already-due focus keeps it as completed, not aborted', () => {
    const out = stopTimer(running(T0), T0 + 40 * MIN)
    expect(out.ended).toMatchObject({ reason: 'elapsed', record: { completed: true, durationSec: 1500 } })
    expect(out.state.phase).toBe('idle')
  })

  test('stopping from finished just returns to idle', () => {
    const finished = finishFocus(createTimer(), T0).state
    const out = stopTimer(finished, T0 + 30 * MIN)
    expect(out.ended).toBeNull()
    expect(out.state.phase).toBe('idle')
    expect(out.state.kind).toBe('focus')
  })

  test('stopping when idle changes nothing', () => {
    const idle = createTimer()
    expect(stopTimer(idle, T0)).toEqual({ state: idle, ended: null })
  })
})

describe('timer: mode, task and display', () => {
  test('mode can only change while idle or finished', () => {
    const r = running()
    expect(setMode(r, 'stopwatch')).toBe(r)
    const sw = setMode(createTimer(), 'stopwatch')
    expect(modeOf(sw)).toBe('stopwatch')
    const finished = finishFocus(createTimer(), T0).state
    expect(setMode(finished, 'stopwatch').phase).toBe('idle')
  })

  test('switching back to pomodoro restores focus and keeps the linked task', () => {
    const sw = setMode(setTask(createTimer(), 'x'), 'stopwatch')
    expect(setMode(sw, 'pomodoro')).toMatchObject({ kind: 'focus', taskId: 'x' })
  })

  test('stopwatch counts up with no target', () => {
    const sw = startTimer(setMode(createTimer(), 'stopwatch'), T0, CFG)
    expect(sw.targetMs).toBeNull()
    expect(displayMs(sw, T0 + 125 * MIN, CFG)).toBe(125 * MIN)
    expect(isDue(sw, T0 + 999 * MIN)).toBe(false)
    expect(progressOf(sw, T0 + 125 * MIN, CFG)).toBe(0)
  })

  test('shows the configured length while idle and the next length while finished', () => {
    expect(displayMs(createTimer(), T0, CFG)).toBe(25 * MIN)
    const finished = finishFocus(createTimer(), T0).state
    expect(displayMs(finished, T0 + 26 * MIN, CFG)).toBe(5 * MIN)
  })

  test('progress goes from 0 to 1 and stays within bounds', () => {
    const s = running(T0)
    expect(progressOf(s, T0, CFG)).toBe(0)
    expect(progressOf(s, T0 + 5 * MIN, CFG)).toBeCloseTo(0.2)
    expect(progressOf(s, T0 + 100 * MIN, CFG)).toBe(1)
    expect(progressOf(createTimer(), T0, CFG)).toBe(0)
  })

  test('task can be changed at any time and applies to the final record', () => {
    const s = setTask(running(T0), 'a')
    const changed = setTask(s, 'b')
    expect(stopTimer(changed, T0 + 5 * MIN).ended?.record?.taskId).toBe('b')
  })

  test('nextHint is empty unless a session is waiting', () => {
    expect(nextHint(createTimer())).toBe('')
    expect(nextHint(finishFocus(createTimer(), T0, CFG).state)).toBe('다음: 짧은 휴식')
  })
})
