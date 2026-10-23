import { Plus } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../app/PageHeader'
import { addDays, isISODate, startOfWeek } from '../../domain/date'
import { isHabitDone, isHabitDue } from '../../domain/stats'
import type { Habit, ISODate } from '../../domain/types'
import { useSettings, useTable, useToday } from '../../hooks/data'
import { useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { ArchivedHabits } from './ArchivedHabits'
import { createHabit } from './commands'
import { HabitDetail } from './HabitDetail'
import { HabitDialog } from './HabitDialog'
import { HabitEmpty } from './HabitEmpty'
import { HabitRow } from './HabitRow'
import { groupHabits, splitArchived } from './habitView'
import type { HabitExample } from './habitDraft'
import { useContainerWide } from './useContainerWide'
import { useHabitActions } from './useHabitActions'
import { ValuePopover } from './ValuePopover'
import { WeekToolbar, WeekdayHead } from './WeekHeader'
import './habits.css'

const WIDE_PX = 1100
const DAYS_PER_WEEK = 7

interface ValueTarget {
  habitId: string
  date: ISODate
}

export function HabitsScreen() {
  const habits = useTable('habits')
  const today = useToday()
  const { weekStartsOn } = useSettings()
  const actions = useHabitActions()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<{ habit: Habit | null } | null>(null)
  const [valueTarget, setValueTarget] = useState<ValueTarget | null>(null)
  const valueAnchor = useRef<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const wide = useContainerWide(rootRef, WIDE_PX)
  const detailId = useId()

  const rawDate = params.get('date')
  const weekStart = startOfWeek(isISODate(rawDate) ? rawDate : today, weekStartsOn)
  const currentWeekStart = startOfWeek(today, weekStartsOn)
  const selectedId = params.get('habit')

  const { active, archived } = useMemo(() => splitArchived(habits), [habits])
  const groups = useMemo(() => groupHabits(active), [active])
  const groupNames = useMemo(() => [...new Set(habits.flatMap((h) => (h.group ? [h.group] : [])))], [habits])
  const selected = active.find((h) => h.id === selectedId) ?? null

  const patchParams = useCallback(
    (patch: { date?: ISODate | null; habit?: string | null }) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const moveWeek = (direction: -1 | 1) => {
    const target = addDays(weekStart, direction * DAYS_PER_WEEK)
    patchParams({ date: target === currentWeekStart ? null : target })
  }

  const openValue = (habit: Habit, date: ISODate, anchor: HTMLElement) => {
    valueAnchor.current = anchor
    setValueTarget({ habitId: habit.id, date })
  }

  const createFromExample = (example: HabitExample) => {
    try {
      const { changes, habit } = createHabit(useApp.getState().entities, {
        name: example.name,
        color: example.color,
        frequency: { type: 'daily' },
        goal: example.goal,
        block: null,
        startDate: today,
        group: null,
        reminderTime: null,
      })
      useApp.getState().commit(changes, '습관 추가')
      patchParams({ habit: habit.id })
    } catch (e) {
      useToasts.getState().push(e instanceof Error ? e.message : '습관을 만들지 못했어요', { tone: 'error' })
    }
  }

  const dueToday = active.filter((h) => isHabitDue(h, today))
  const doneToday = dueToday.filter((h) => isHabitDone(h, today)).length
  const valueHabit = valueTarget ? (habits.find((h) => h.id === valueTarget.habitId) ?? null) : null
  const showGroupTitles = groups.length > 1 || groups.some((g) => g.name !== null)

  const detail = selected ? (
    <HabitDetail
      habit={selected}
      today={today}
      weekStart={weekStart}
      weekStartsOn={weekStartsOn}
      actions={actions}
      onEdit={() => setEditing({ habit: selected })}
      onClose={() => patchParams({ habit: null })}
    />
  ) : null

  return (
    <div className="habits" ref={rootRef}>
      <PageHeader
        title="습관"
        eyebrow="매일 하는 일"
        count={active.length}
        description={dueToday.length > 0 ? `오늘 할 습관 ${dueToday.length}개 중 ${doneToday}개를 마쳤어요.` : '매일 조금씩 쌓는 기록이에요.'}
        actions={
          <button type="button" className="btn-accent habits__add" onClick={() => setEditing({ habit: null })}>
            <Plus size={16} aria-hidden="true" /> 새 습관
          </button>
        }
      />

      {habits.length === 0 ? (
        <HabitEmpty onPick={createFromExample} onCreate={() => setEditing({ habit: null })} />
      ) : (
        <>
          <WeekToolbar weekStart={weekStart} isCurrentWeek={weekStart === currentWeekStart} onMove={moveWeek} onToday={() => patchParams({ date: null })} />
          <div className="habits__layout" data-wide={wide}>
            <div className="hlist">
              {active.length === 0 ? <p className="page-note">진행 중인 습관이 없어요. 아래에서 복원하거나 새로 만들어 보세요.</p> : <WeekdayHead weekStart={weekStart} today={today} />}
              {groups.map((group) => (
                <section key={group.name ?? '__none'} className="hgroup" aria-label={group.name ?? '그룹 없음'}>
                  {showGroupTitles ? (
                    <h2 className="hgroup__title">
                      {group.name ?? '그룹 없음'}
                      <span>{group.habits.length}</span>
                    </h2>
                  ) : null}
                  <ul>
                    {group.habits.map((habit) => (
                      <HabitRow
                        key={habit.id}
                        habit={habit}
                        today={today}
                        weekStart={weekStart}
                        selected={habit.id === selected?.id}
                        detailId={detailId}
                        onSelect={() => patchParams({ habit: habit.id === selected?.id ? null : habit.id })}
                        onEdit={() => setEditing({ habit })}
                        onEditValue={(date, anchor) => openValue(habit, date, anchor)}
                        actions={actions}
                        expansion={!wide && habit.id === selected?.id ? <div id={detailId}>{detail}</div> : undefined}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              <ArchivedHabits habits={archived} actions={actions} onEdit={(habit) => setEditing({ habit })} />
            </div>
            {wide ? (
              <aside className="habits__aside" id={detailId} aria-label="습관 자세히">
                {detail ?? <p className="habits__hint">습관 이름을 누르면 최근 12주 기록과 연속 일수가 여기에 보여요.</p>}
              </aside>
            ) : null}
          </div>
        </>
      )}

      <HabitDialog
        open={editing !== null}
        habit={editing?.habit ?? null}
        today={today}
        weekStartsOn={weekStartsOn}
        groups={groupNames}
        actions={actions}
        onClose={() => setEditing(null)}
        onSaved={(habit) => patchParams({ habit: habit.id })}
      />
      <ValuePopover
        habit={valueHabit}
        date={valueTarget?.date ?? today}
        anchorRef={valueAnchor}
        onSave={(value) => valueTarget && actions.write(valueTarget.habitId, valueTarget.date, value)}
        onClose={() => setValueTarget(null)}
      />
    </div>
  )
}
