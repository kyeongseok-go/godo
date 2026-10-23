import { Trash2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { weekdayOrder } from '../../domain/calendarGrid'
import { WEEKDAY_KO } from '../../domain/date'
import type { Habit, ISODate, Weekday } from '../../domain/types'
import { useApp } from '../../store/app'
import { PALETTE } from '../../store/defaults'
import { Dialog } from '../../ui/Dialog'
import { useToasts } from '../../ui/toast'
import { createHabit, patchHabit } from './commands'
import { draftFromHabit, draftToInput, emptyDraft, toggleDraftDay, validateDraft } from './habitDraft'
import type { FrequencyType, HabitDraft } from './habitDraft'
import type { HabitActions } from './useHabitActions'
import '../projects/entity-dialogs.css'

const FREQUENCIES: ReadonlyArray<{ id: FrequencyType; label: string }> = [
  { id: 'daily', label: '매일' },
  { id: 'weekdays', label: '요일 선택' },
  { id: 'timesPerWeek', label: '주 N회' },
]

interface HabitDialogProps {
  open: boolean
  /** null 이면 새로 만든다 */
  habit: Habit | null
  today: ISODate
  weekStartsOn: 0 | 1
  groups: readonly string[]
  actions: HabitActions
  onClose: () => void
  onSaved?: (habit: Habit) => void
}

export function HabitDialog(props: HabitDialogProps) {
  const { open, habit, onClose } = props
  return (
    <Dialog open={open} onClose={onClose} label={habit ? '습관 편집' : '습관 만들기'}>
      <HabitForm key={habit?.id ?? 'new'} {...props} />
    </Dialog>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: ReadonlyArray<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="hform__seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function HabitForm({ habit, today, weekStartsOn, groups, actions, onClose, onSaved }: HabitDialogProps) {
  const commit = useApp((s) => s.commit)
  const [draft, setDraft] = useState<HabitDraft>(() => (habit ? draftFromHabit(habit) : emptyDraft(today, PALETTE[Object.keys(useApp.getState().entities.habits).length % PALETTE.length])))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const groupListId = useId()
  const set = (patch: Partial<HabitDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }

  const save = () => {
    const problem = validateDraft(draft)
    if (problem) return setError(problem)
    try {
      const state = useApp.getState().entities
      if (habit) {
        commit(patchHabit(state, habit.id, draftToInput(draft)), '습관 수정')
      } else {
        const created = createHabit(state, draftToInput(draft))
        commit(created.changes, '습관 추가')
        onSaved?.(created.habit)
      }
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : '저장하지 못했어요'
      useToasts.getState().push(message, { tone: 'error' })
    }
  }

  return (
    <div className="ed hform">
      <header className="ed__head">
        <h2>{habit ? '습관 편집' : '습관 만들기'}</h2>
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
        <label className="ed__field">
          <span>이름</span>
          <input data-autofocus value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="예) 물 마시기" />
        </label>

        <div className="ed__field">
          <span>색</span>
          <div className="swatches" role="radiogroup" aria-label="색">
            {PALETTE.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={draft.color === c} aria-label={c} className="swatch" style={{ background: c }} data-active={draft.color === c} onClick={() => set({ color: c })} />
            ))}
          </div>
        </div>

        <div className="ed__field">
          <span>빈도</span>
          <Segmented label="빈도" value={draft.frequencyType} options={FREQUENCIES} onChange={(frequencyType) => set({ frequencyType })} />
          {draft.frequencyType === 'weekdays' ? (
            <div className="hform__days" role="group" aria-label="요일">
              {weekdayOrder(weekStartsOn).map((d) => (
                <button key={d} type="button" aria-pressed={draft.days.includes(d as Weekday)} onClick={() => set({ days: toggleDraftDay(draft.days, d as Weekday) })}>
                  {WEEKDAY_KO[d]}
                </button>
              ))}
            </div>
          ) : null}
          {draft.frequencyType === 'timesPerWeek' ? (
            <label className="hform__inline">
              일주일에
              <input type="number" min={1} max={7} value={draft.timesPerWeek} onChange={(e) => set({ timesPerWeek: Number(e.target.value) })} aria-label="주당 횟수" />
              회
            </label>
          ) : null}
        </div>

        <div className="ed__field">
          <span>하루 목표</span>
          <Segmented
            label="목표 종류"
            value={draft.goalKind}
            options={[
              { id: 'check', label: '체크' },
              { id: 'count', label: '횟수' },
            ]}
            onChange={(goalKind) => set({ goalKind })}
          />
          {draft.goalKind === 'count' ? (
            <div className="hform__inline">
              <input type="number" min={1} step="any" value={Number.isNaN(draft.target) ? '' : draft.target} onChange={(e) => set({ target: e.target.value === '' ? Number.NaN : Number(e.target.value) })} aria-label="목표 횟수" />
              <input value={draft.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="단위 (잔, 쪽, 분)" aria-label="단위" maxLength={8} />
            </div>
          ) : null}
        </div>

        <div className="hform__pair">
          <label className="ed__field">
            <span>시작일</span>
            <input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </label>
          <label className="ed__field">
            <span>알림 시각</span>
            <input type="time" value={draft.reminderTime} onChange={(e) => set({ reminderTime: e.target.value })} />
          </label>
        </div>

        <div className="ed__field">
          <span>시간 비워 두기</span>
          <label className="ed__check">
            <input
              type="checkbox"
              checked={draft.blockEnabled}
              onChange={(e) => set({ blockEnabled: e.target.checked })}
            />
            이 시간대 안의 빈 자리에 매일 다시 잡기
          </label>
          {draft.blockEnabled ? (
            <div className="hform__inline hform__block">
              <input type="time" value={draft.blockStart} onChange={(e) => set({ blockStart: e.target.value })} aria-label="블록 시작 시각" />
              <span aria-hidden="true">–</span>
              <input type="time" value={draft.blockEnd} onChange={(e) => set({ blockEnd: e.target.value })} aria-label="블록 종료 시각" />
              <input
                type="number"
                min={5}
                step={5}
                value={Number.isNaN(draft.blockDuration) ? '' : draft.blockDuration}
                onChange={(e) => set({ blockDuration: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                aria-label="블록 길이(분)"
              />
              분
            </div>
          ) : null}
        </div>

        <label className="ed__field">
          <span>그룹</span>
          <input list={groupListId} value={draft.group} onChange={(e) => set({ group: e.target.value })} placeholder="예) 아침 루틴 (비워 두면 그룹 없음)" />
          <datalist id={groupListId}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>

        {error ? (
          <p className="ed__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ed__foot">
          {habit && !confirmingDelete ? (
            <button type="button" className="ed__danger" onClick={() => setConfirmingDelete(true)}>
              <Trash2 size={15} aria-hidden="true" /> 삭제
            </button>
          ) : null}
          {habit && confirmingDelete ? (
            <span className="hform__confirm" role="alert">
              기록까지 모두 지워져요.
              <button
                type="button"
                className="ed__danger"
                onClick={() => {
                  actions.remove(habit.id, habit.name)
                  onClose()
                }}
              >
                정말 삭제
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmingDelete(false)}>
                취소
              </button>
            </span>
          ) : null}
          <span className="ed__spacer" />
          {habit && !confirmingDelete ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                actions.archive(habit.id, !habit.archived)
                onClose()
              }}
            >
              {habit.archived ? '복원' : '보관'}
            </button>
          ) : null}
          {!confirmingDelete ? (
            <button type="submit" className="btn-accent hform__save">
              {habit ? '저장' : '만들기'}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
