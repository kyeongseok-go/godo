import { CalendarCheck, ListChecks, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { paths } from '../nav'
import { useMemo, useState } from 'react'
import { describeDate } from '../../domain/format'
import { fromISODate, WEEKDAY_KO } from '../../domain/date'
import { SMART_LIST_TITLES, smartListGroups } from '../../features/lists/smartLists'
import type { SmartListId } from '../../features/lists/smartLists'
import { SelectionBar } from '../../features/tasks/SelectionBar'
import { TaskList } from '../../features/tasks/TaskList'
import { useTaskActions } from '../../hooks/actions'
import { useEngineContext } from '../../hooks/data'
import { INBOX_ID } from '../../domain/types'
import { TodayHabits } from '../../features/habits/TodayHabits'
import { CapacityMeter } from '../../features/plan/CapacityMeter'
import { triageQueue } from '../../features/triage/logic'
import { TriageMode } from '../../features/triage/TriageMode'
import { PageHeader } from '../PageHeader'

const EMPTY: Record<SmartListId, string> = {
  inbox: '받은편지함이 비었어요. 떠오르는 건 일단 여기에 던져 두세요.',
  today: '오늘 할 일이 없어요. 여유로운 하루네요.',
  upcoming: '앞으로 7일은 비어 있어요.',
  now: '지금 바로 할 수 있는 일이 없어요.',
  all: '아직 할 일이 없어요. Q를 눌러 추가해 보세요.',
  someday: '"언젠가" 보관함이 비었어요. 지금은 못 하지만 잊고 싶지 않은 일을 여기에 두세요.',
  completed: '완료한 일이 아직 없어요.',
  canceled: '취소한 계획이 없어요.',
  trash: '휴지통이 비었어요.',
}

const DESC: Partial<Record<SmartListId, string>> = {
  now: '시작일이 되었고, 보류·막힘이 없는 일만 모았어요.',
  someday: '날짜를 정하지 않고 보관해 둔 일',
  trash: '30일이 지나면 자동으로 영구 삭제돼요.',
}

export function SmartListPage({ id }: { id: SmartListId }) {
  const ctx = useEngineContext()
  const actions = useTaskActions()
  const groups = useMemo(() => smartListGroups(id, ctx), [id, ctx])
  const count = groups.reduce((n, g) => n + g.tasks.length, 0)
  const [triageOpen, setTriageOpen] = useState(false)
  const triageCount = id === 'inbox' ? triageQueue(ctx).length : 0
  const overdue = groups.find((g) => g.key === 'overdue')?.tasks ?? []
  const d = fromISODate(ctx.today)
  const eyebrow = id === 'today' ? `${describeDate(ctx.today, ctx.today)} · ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY_KO[d.getDay()]}요일` : undefined

  return (
    <>
      <PageHeader
        title={SMART_LIST_TITLES[id]}
        eyebrow={eyebrow}
        count={count}
        description={DESC[id]}
        actions={
          id === 'inbox' && triageCount > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => setTriageOpen(true)}>
              <ListChecks size={15} aria-hidden="true" /> 정리 시작 ({triageCount})
            </button>
          ) : id === 'trash' && count > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => actions.emptyTrash()}>
              <Trash2 size={15} aria-hidden="true" /> 휴지통 비우기
            </button>
          ) : undefined
        }
      />
      {id === 'today' ? <CapacityMeter date={ctx.today} /> : null}
      {id === 'today' ? <TodayHabits /> : null}
      {id === 'today' && overdue.length > 0 ? (
        <div className="overdue-banner" role="status">
          <p>
            <strong>{overdue.length}개</strong>가 날짜를 지났어요. 하나씩 정리하거나, 한 번에 오늘로 옮길 수 있어요.
          </p>
          <div>
            <Link to={paths.replan} className="btn-ghost">
              하나씩 정리
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                actions.patchMany(overdue.map((t) => t.id), { startDate: ctx.today }, '기한 지난 일을 오늘로')
              }}
            >
              <CalendarCheck size={15} aria-hidden="true" /> 모두 오늘로
            </button>
          </div>
        </div>
      ) : null}
      <TaskList
        groups={groups}
        showProject={id !== 'inbox'}
        nested={id === 'inbox' || id === 'someday'}
        sortable={id === 'inbox' || id === 'someday'}
        empty={EMPTY[id]}
        addDefaults={id === 'inbox' ? { projectId: INBOX_ID } : id === 'today' ? { startDate: ctx.today } : id === 'completed' || id === 'trash' || id === 'canceled' ? undefined : {}}
      />
      <SelectionBar />
      {id === 'inbox' ? <TriageMode open={triageOpen} onClose={() => setTriageOpen(false)} /> : null}
    </>
  )
}
