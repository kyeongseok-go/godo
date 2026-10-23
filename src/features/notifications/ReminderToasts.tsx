import { BellRing, Check, X } from 'lucide-react'
import { useEffect } from 'react'
import { formatTime } from '../../domain/format'
import type { Task, TimeOfDay } from '../../domain/types'
import { useOpenTask } from '../../hooks/openTask'
import { useTaskActions } from '../../hooks/actions'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { useReminderStore } from './reminderStore'
import { isReminderLive } from './schedule'
import type { DueReminder } from './schedule'
import { SNOOZE_CHOICES, snoozeUntil } from './snooze'
import type { SnoozeChoice } from './snooze'
import './notifications.css'

/** 화면에 동시에 펼쳐 둘 카드 수. 넘치면 "이전 알림 N건"으로 접는다. */
const MAX_VISIBLE = 3

const SNOOZE_DONE: Record<SnoozeChoice, string> = {
  '10m': '10분 뒤에 다시 알려 드려요',
  '1h': '1시간 뒤에 다시 알려 드려요',
  tomorrow: '내일 아침에 다시 알려 드려요',
}

const clockOf = (at: number): string => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function snoozeCard(key: string, choice: SnoozeChoice, workStart: TimeOfDay): void {
  useReminderStore.getState().snooze(key, snoozeUntil(choice, Date.now(), workStart))
  useToasts.getState().push(SNOOZE_DONE[choice])
}

interface CardProps {
  card: DueReminder
  persistent: boolean
  timeFormat: '12h' | '24h'
  onComplete: () => void
  onOpen: () => void
  onSnooze: (choice: SnoozeChoice) => void
  onClose: () => void
}

function ReminderCard({ card, persistent, timeFormat, onComplete, onOpen, onSnooze, onClose }: CardProps) {
  return (
    <article
      className="reminder-card"
      data-persistent={persistent}
      aria-label={`${card.title} 알림`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <header className="reminder-card__head">
        <span className="reminder-card__label">
          <BellRing size={14} aria-hidden="true" />
          {persistent ? '계속 알림' : '알림'}
        </span>
        <time className="reminder-card__time">{formatTime(clockOf(card.at), timeFormat)}</time>
        <button type="button" className="reminder-card__close" aria-label="알림 닫기" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <h3 className="reminder-card__title">{card.title}</h3>
      <p className="reminder-card__body">{card.body}</p>
      <div className="reminder-card__actions">
        <button type="button" className="reminder-card__primary" onClick={onComplete}>
          <Check size={16} aria-hidden="true" />
          완료
        </button>
        <button type="button" className="reminder-card__ghost" onClick={onOpen}>
          열기
        </button>
      </div>
      <div className="reminder-card__snooze" role="group" aria-label="알림 미루기">
        <span className="reminder-card__snooze-label" aria-hidden="true">
          미루기
        </span>
        {SNOOZE_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="reminder-card__ghost"
            aria-label={`${choice.label} 다시 알림`}
            onClick={() => onSnooze(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </article>
  )
}

/** 앱 안 알림 카드 묶음. Shell 에서 한 번만 렌더링한다. */
export function ReminderToasts() {
  const cards = useReminderStore((s) => s.cards)
  const dismiss = useReminderStore((s) => s.dismiss)
  const dismissAll = useReminderStore((s) => s.dismissAll)
  const tasks = useApp((s) => s.entities.tasks)
  const workStart = useApp((s) => s.settings.workStart)
  const timeFormat = useApp((s) => s.settings.timeFormat)
  const actions = useTaskActions()
  const { open } = useOpenTask()

  // 다른 곳에서 완료·삭제·일정 변경된 작업의 카드는 치운다.
  useEffect(() => {
    for (const card of cards) {
      if (!isReminderLive(tasks[card.taskId], card.key)) dismiss(card.key)
    }
  }, [cards, tasks, dismiss])

  const newestFirst = [...cards].reverse()
  const visible = newestFirst.slice(0, MAX_VISIBLE)
  const hidden = newestFirst.length - visible.length

  return (
    <section className="reminder-stack" aria-label="할 일 알림" aria-live="polite">
      {visible.map((card) => {
        const task: Task | undefined = tasks[card.taskId]
        return (
          <ReminderCard
            key={card.key}
            card={card}
            persistent={task?.persistentReminder ?? false}
            timeFormat={timeFormat}
            onComplete={() => {
              actions.complete(card.taskId)
              dismiss(card.key)
            }}
            onOpen={() => {
              open(card.taskId)
              dismiss(card.key)
            }}
            onSnooze={(choice) => snoozeCard(card.key, choice, workStart)}
            onClose={() => dismiss(card.key)}
          />
        )
      })}
      {hidden > 0 ? (
        <div className="reminder-stack__more">
          <span>이전 알림 {hidden}건</span>
          <button type="button" onClick={dismissAll}>
            모두 닫기
          </button>
        </div>
      ) : null}
    </section>
  )
}
