import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { countdownInfo } from '../../domain/stats'
import type { Countdown, ISODate } from '../../domain/types'
import { useApp } from '../../store/app'
import { PALETTE } from '../../store/defaults'
import { Dialog } from '../../ui/Dialog'
import { useToasts } from '../../ui/toast'
import { createCountdown, deleteCountdown, patchCountdown } from './commands'
import type { CountdownInput } from './commands'
import { validateCountdownDraft } from './countdownView'
import '../projects/entity-dialogs.css'

/** 새로 만들 때 미리 채워 둘 값(빈 상태의 예시 칩이 쓴다) */
export interface CountdownPreset {
  name: string
  repeatYearly: boolean
  color: string
}

interface CountdownDialogProps {
  open: boolean
  /** 편집할 디데이. null 이면 새로 만든다 */
  countdown: Countdown | null
  preset: CountdownPreset | null
  today: ISODate
  onClose: () => void
}

export function CountdownDialog(props: CountdownDialogProps) {
  const { open, countdown, onClose } = props
  return (
    <Dialog open={open} onClose={onClose} label={countdown ? '디데이 편집' : '디데이 만들기'}>
      <CountdownForm key={countdown?.id ?? props.preset?.name ?? 'new'} {...props} />
    </Dialog>
  )
}

function CountdownForm({ countdown, preset, today, onClose }: CountdownDialogProps) {
  const commit = useApp((s) => s.commit)
  const [draft, setDraft] = useState<CountdownInput>(() => ({
    name: countdown?.name ?? preset?.name ?? '',
    date: countdown?.date ?? today,
    color: countdown?.color ?? preset?.color ?? PALETTE[Object.keys(useApp.getState().entities.countdowns).length % PALETTE.length],
    repeatYearly: countdown?.repeatYearly ?? preset?.repeatYearly ?? false,
  }))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const set = (patch: Partial<CountdownInput>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }

  const save = () => {
    const problem = validateCountdownDraft(draft)
    if (problem) return setError(problem)
    try {
      const state = useApp.getState().entities
      if (countdown) commit(patchCountdown(state, countdown.id, draft), '디데이 수정')
      else commit(createCountdown(state, draft).changes, '디데이 추가')
      onClose()
    } catch (e) {
      useToasts.getState().push(e instanceof Error ? e.message : '저장하지 못했어요', { tone: 'error' })
    }
  }

  const remove = () => {
    if (!countdown) return
    commit(deleteCountdown(useApp.getState().entities, countdown.id), '디데이 삭제')
    useToasts.getState().push(`'${countdown.name}' 디데이를 지웠어요`, {
      actionLabel: '되돌리기',
      onAction: () => useApp.getState().undo(),
    })
    onClose()
  }

  const preview = validateCountdownDraft(draft) === null ? countdownInfo({ id: 'preview', order: 0, ...draft }, today).label : null

  return (
    <div className="ed cdform">
      <header className="ed__head">
        <h2>{countdown ? '디데이 편집' : '디데이 만들기'}</h2>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <form
        className="ed__form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <p className="cdform__preview" aria-live="polite">
          <span>미리보기</span>
          <strong>{preview ?? 'D-?'}</strong>
        </p>
        <label className="ed__field">
          <span>이름</span>
          <input autoFocus data-autofocus value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="예) 엄마 생일" />
        </label>
        <label className="ed__field">
          <span>날짜</span>
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <div className="ed__field">
          <span>색</span>
          <div className="swatches" role="radiogroup" aria-label="색">
            {PALETTE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draft.color === c} aria-label={c} className="swatch" style={{ background: c }} data-active={draft.color === c} onClick={() => set({ color: c })} />
            ))}
          </div>
        </div>
        <label className="ed__check">
          <input type="checkbox" checked={draft.repeatYearly} onChange={(e) => set({ repeatYearly: e.target.checked })} />
          매년 반복 (생일·기념일처럼 해마다 돌아오는 날)
        </label>
        {error ? (
          <p className="ed__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ed__foot">
          {countdown && !confirmingDelete ? (
            <button type="button" className="ed__danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={15} aria-hidden="true" /> 삭제
            </button>
          ) : null}
          {countdown && confirmingDelete ? (
            <span className="cdform__confirm" role="alert">
              이 디데이를 지울까요?
              <button type="button" className="ed__danger" onClick={remove}>
                정말 삭제
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(false)}>
                취소
              </button>
            </span>
          ) : null}
          <span className="ed__spacer" />
          {!confirmingDelete ? (
            <button type="submit" className="btn-accent cdform__save">
              {countdown ? '저장' : '만들기'}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
