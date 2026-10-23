import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../../app/nav'
import { useTaskActions } from '../../hooks/actions'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { ConfirmDialog } from '../settings/ConfirmDialog'
import { Group, InfoRow } from '../settings/fields'
import { TRASH_KEEP_DAYS } from './constants'

export function TrashSection() {
  const count = useApp((s) => Object.values(s.entities.tasks).filter((t) => t.deletedAt !== null).length)
  const actions = useTaskActions()
  const [confirming, setConfirming] = useState(false)

  const empty = (): void => {
    actions.emptyTrash()
    setConfirming(false)
    useToasts.getState().push(`휴지통을 비웠어요`, { actionLabel: '되돌리기', onAction: () => useApp.getState().undo() })
  }

  return (
    <Group title="휴지통" description={`지운 할 일은 ${TRASH_KEEP_DAYS}일 동안 휴지통에 두었다가, 그 뒤 앱을 열 때 저절로 영구 삭제해요.`}>
      <InfoRow label={count > 0 ? `휴지통에 할 일 ${count}개` : '휴지통이 비어 있어요'} hint="휴지통 화면에서 하나씩 복원할 수 있어요.">
        <span className="dt-actions">
          <Link to={paths.trash} className="st-btn">
            휴지통 열기
          </Link>
          <button type="button" className="st-btn" disabled={count === 0} onClick={() => setConfirming(true)}>
            <Trash2 size={14} aria-hidden="true" /> 휴지통 비우기
          </button>
        </span>
      </InfoRow>

      <ConfirmDialog open={confirming} title="휴지통을 비울까요?" confirmLabel="비우기" danger onCancel={() => setConfirming(false)} onConfirm={empty}>
        <p>
          <strong>할 일 {count}개가 영구 삭제돼요.</strong> 댓글도 함께 지워져요.
        </p>
        <p>비운 직후에는 알림창의 ‘되돌리기’나 실행 취소로 돌릴 수 있어요.</p>
      </ConfirmDialog>
    </Group>
  )
}
