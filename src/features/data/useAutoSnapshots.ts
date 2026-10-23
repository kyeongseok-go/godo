import { useEffect } from 'react'
import { db, useApp } from '../../store/app'
import { newId } from '../../store/id'
import { useToasts } from '../../ui/toast'

const CHECK_INTERVAL_MS = 10 * 60_000
/** 자동 백업 실패를 다시 알리기까지의 최소 간격 */
const FAILURE_NOTICE_INTERVAL_MS = 60 * 60_000

function describe(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

/**
 * 앱이 준비된 뒤 마지막 스냅샷이 6시간 넘었고 데이터가 바뀌었으면 자동 백업 스냅샷을 만든다.
 * 백업 직렬화 코드는 처음 필요할 때만 불러온다(첫 화면 번들에 넣지 않으려는 것이다).
 */
export function useAutoSnapshots(): void {
  const ready = useApp((s) => s.ready)

  useEffect(() => {
    if (!ready) return
    let changeCount = 0
    let snapshotCount = 0
    let running = false
    // 마지막으로 실패를 알린 시각. 계속 실패하는데 조용하면 백업이 되는 줄 알게 된다.
    let failureNoticedAt = 0

    const unsubscribe = useApp.subscribe((state, prev) => {
      if (state.entities !== prev.entities) changeCount += 1
    })

    const tick = async (): Promise<void> => {
      if (running) return
      running = true
      const seen = changeCount
      try {
        const [{ runAutoSnapshot }, { collectAppData }] = await Promise.all([import('./snapshots'), import('./appData')])
        const result = await runAutoSnapshot(db, {
          data: collectAppData(useApp.getState()),
          dirty: seen !== snapshotCount,
          nowMs: Date.now(),
          id: newId(),
        })
        if (result === 'created') snapshotCount = seen
      } catch (error: unknown) {
        // 토스트가 10분마다 뜨지 않도록 간격을 두되, 계속 실패하면 다시 알린다.
        const now = Date.now()
        if (now - failureNoticedAt >= FAILURE_NOTICE_INTERVAL_MS) {
          failureNoticedAt = now
          useToasts
            .getState()
            .push(`자동 백업을 만들지 못했어요. 설정 > 데이터에서 직접 내려받아 두세요. (${describe(error)})`, {
              tone: 'error',
              ttlMs: 12000,
            })
        }
      } finally {
        running = false
      }
    }

    void tick()
    const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [ready])
}
