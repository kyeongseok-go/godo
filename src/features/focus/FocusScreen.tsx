import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../app/PageHeader'
import { useSettings } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { FocusSettings } from './FocusSettings'
import { FocusStats } from './FocusStats'
import { useFocus } from './focusStore'
import { TimerStage } from './TimerStage'
import './focus.css'
import './focus-picker.css'
import './focus-prefs.css'
import './focus-stats.css'

/**
 * ?task=<id> 로 들어오면 그 할 일을 미리 연결하고 주소에서는 지운다.
 * 주소에 남겨 두면 상세 패널이 같은 파라미터로 열리고, 새로고침 때 고른 할 일을 되돌려 버린다.
 */
function useLinkTaskFromUrl(): void {
  const [params, setParams] = useSearchParams()
  const taskParam = params.get('task')
  const ready = useApp((s) => s.ready)

  useEffect(() => {
    if (!taskParam || !ready) return
    const { entities } = useApp.getState()
    const { timer, setTask } = useFocus.getState()
    const exists = taskParam in entities.tasks
    const inSession = timer.phase === 'running' || timer.phase === 'paused'
    if (exists && inSession && timer.taskId !== taskParam) {
      useToasts.getState().push('진행 중인 집중이 있어서 연결된 할 일을 바꾸지 않았어요.')
    } else if (exists) {
      setTask(taskParam)
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('task')
        return next
      },
      { replace: true },
    )
  }, [taskParam, ready, setParams])
}

export function FocusScreen() {
  const config = useSettings().pomodoro
  useLinkTaskFromUrl()

  return (
    <>
      <PageHeader
        title="집중"
        eyebrow="한 번에 하나만"
        description={`${config.focusMin}분 몰입하고 ${config.shortBreakMin}분 쉬어요. 할 일을 연결하면 실제로 걸린 시간이 쌓여요.`}
      />
      <div className="focus-page">
        <TimerStage />
        <div className="focus-page__side">
          <FocusStats />
          <FocusSettings />
        </div>
      </div>
    </>
  )
}
