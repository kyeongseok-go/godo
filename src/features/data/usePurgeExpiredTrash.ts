import { useEffect } from 'react'
import { purgeExpiredTrash } from '../../store/commands/taskCommands'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { TRASH_KEEP_DAYS } from './constants'

/**
 * 앱이 준비되면 보관 기간이 지난 휴지통 항목을 영구 삭제한다.
 * 사용자가 한 일이 아니므로 실행 취소 기록에는 남기지 않는다.
 */
export function usePurgeExpiredTrash(): void {
  const ready = useApp((s) => s.ready)

  useEffect(() => {
    if (!ready) return
    const { entities, commit } = useApp.getState()
    const changes = purgeExpiredTrash(entities, Date.now(), TRASH_KEEP_DAYS)
    commit(changes, '만료된 휴지통 정리', { history: false })
    // 사용자가 한 일이 아니므로, 영구 삭제가 일어났다면 조용히 지나가지 않고 알린다.
    const purged = changes.deletes.tasks?.length ?? 0
    if (purged > 0) useToasts.getState().push(`휴지통에서 ${TRASH_KEEP_DAYS}일이 지난 할 일 ${purged}개를 영구 삭제했어요`, { ttlMs: 8000 })
  }, [ready])
}
