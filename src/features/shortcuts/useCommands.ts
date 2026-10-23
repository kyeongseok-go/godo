import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { paths } from '../../app/nav'
import { addDays, todayOf } from '../../domain/date'
import { nextWeekStart } from '../../domain/calendarGrid'
import type { ID, Priority } from '../../domain/types'
import { useTaskActions } from '../../hooks/actions'
import { useApp } from '../../store/app'
import { useUI } from '../../store/ui'
import { useToasts } from '../../ui/toast'

export interface Command {
  id: string
  title: string
  group: '이동' | '만들기' | '할 일' | '보기' | '앱'
  /** 기본 단축키. 'g i' 같은 시퀀스 또는 'mod+k' */
  keys?: string
  /** 팔레트에서 찾을 때 쓰는 추가 검색어 */
  aliases?: string
  run: () => void
}

/** 지금 키보드가 가리키는 할 일: 포커스된 행 > 열린 상세 패널 */
export function currentTaskId(): ID | null {
  const row = document.activeElement?.closest?.('[data-task-id]') as HTMLElement | null
  if (row?.dataset.taskId) return row.dataset.taskId
  return useUI.getState().focusedId
}

function moveFocus(delta: 1 | -1): void {
  const rows = [...document.querySelectorAll<HTMLElement>('.task-row[data-task-id]')]
  if (rows.length === 0) return
  const current = rows.findIndex((r) => r === document.activeElement || r.contains(document.activeElement))
  const next = current === -1 ? (delta === 1 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, current + delta))
  rows[next].focus()
  rows[next].scrollIntoView({ block: 'nearest' })
}

export function useCommands(): Command[] {
  const navigate = useNavigate()
  const location = useLocation()
  const [, setParams] = useSearchParams()
  const actions = useTaskActions()

  return useMemo(() => {
    const go = (to: string) => () => navigate(to)
    const ui = () => useUI.getState()
    const state = () => useApp.getState()
    const today = () => todayOf(new Date(), state().settings.dayStartHour)
    const withTask = (fn: (id: ID) => void) => () => {
      const id = currentTaskId()
      if (id) fn(id)
      else useToasts.getState().push('먼저 할 일을 선택해 주세요 (J/K로 이동)')
    }
    const setView = (view: string) => () => {
      if (location.pathname.startsWith('/project/')) setParams((p) => { const n = new URLSearchParams(p); n.set('view', view); return n })
      else useToasts.getState().push('프로젝트 화면에서 쓸 수 있어요')
    }
    const priority = (p: Priority) => withTask((id) => actions.patch(id, { priority: p }, '우선순위 수정'))
    // 날짜는 단축키를 누른 시점에 계산한다(자정을 넘겨 켜 둔 탭에서도 맞도록).
    const schedule = (pickDate: () => string | null) =>
      withTask((id) => {
        const date = pickDate()
        actions.patch(id, { startDate: date, ...(date === null ? { startTime: null, dayPart: null } : {}) }, '일정 수정')
      })

    const list: Command[] = [
      { id: 'go.inbox', title: '받은편지함으로 이동', group: '이동', keys: 'g i', run: go(paths.inbox) },
      { id: 'go.today', title: '오늘로 이동', group: '이동', keys: 'g t', run: go(paths.today) },
      { id: 'go.upcoming', title: '다음 7일로 이동', group: '이동', keys: 'g u', run: go(paths.upcoming) },
      { id: 'go.now', title: '지금 할 수 있는 것으로 이동', group: '이동', keys: 'g n', run: go(paths.now) },
      { id: 'go.all', title: '전체 할 일로 이동', group: '이동', keys: 'g a', run: go(paths.all) },
      { id: 'go.calendar', title: '캘린더로 이동', group: '이동', keys: 'g c', run: go(paths.calendar) },
      { id: 'go.matrix', title: '아이젠하워 매트릭스로 이동', group: '이동', keys: 'g m', run: go(paths.matrix) },
      { id: 'go.timeline', title: '타임라인으로 이동', group: '이동', run: go(paths.timeline) },
      { id: 'go.habits', title: '습관으로 이동', group: '이동', keys: 'g h', run: go(paths.habits) },
      { id: 'go.focus', title: '집중(포모도로)으로 이동', group: '이동', keys: 'g f', run: go(paths.focus) },
      { id: 'go.countdown', title: '디데이로 이동', group: '이동', run: go(paths.countdown) },
      { id: 'go.productivity', title: '생산성으로 이동', group: '이동', keys: 'g p', run: go(paths.productivity) },
      { id: 'go.summary', title: '요약 보고서로 이동', group: '이동', run: go(paths.summary) },
      { id: 'go.review', title: '주간 리뷰로 이동', group: '이동', keys: 'g r', run: go(paths.review) },
      { id: 'go.plan', title: '오늘 계획하기로 이동', group: '이동', run: go(paths.plan) },
      { id: 'go.replan', title: '미완료 정리로 이동', group: '이동', run: go(paths.replan) },
      { id: 'go.someday', title: '언젠가로 이동', group: '이동', run: go(paths.someday) },
      { id: 'go.completed', title: '완료한 일로 이동', group: '이동', run: go(paths.completed) },
      { id: 'go.trash', title: '휴지통으로 이동', group: '이동', run: go(paths.trash) },
      { id: 'go.settings', title: '설정으로 이동', group: '이동', keys: 'g s', run: go(paths.settings()) },
      { id: 'go.help', title: '사용 가이드로 이동', group: '이동', aliases: 'help guide 도움말 설명서', run: go(paths.help) },
      { id: 'go.search', title: '검색', group: '이동', keys: '/', aliases: 'search find', run: go(paths.search()) },

      { id: 'add.task', title: '작업 추가', group: '만들기', keys: 'q', aliases: 'new add create 추가', run: () => ui().openQuickAdd() },
      { id: 'add.project', title: '프로젝트 추가', group: '만들기', run: () => ui().openEntityDialog({ kind: 'project' }) },
      { id: 'add.label', title: '라벨 추가', group: '만들기', run: () => ui().openEntityDialog({ kind: 'label' }) },
      { id: 'add.filter', title: '필터 추가', group: '만들기', run: () => ui().openEntityDialog({ kind: 'filter' }) },
      {
        id: 'add.subtask',
        title: '선택한 할 일에 하위 작업 추가',
        group: '만들기',
        keys: 'shift+a',
        run: withTask((id) => {
          const t = state().entities.tasks[id]
          if (t) ui().openQuickAdd({ parentId: id, projectId: t.projectId, sectionId: t.sectionId })
        }),
      },

      { id: 'task.next', title: '다음 할 일로 이동', group: '할 일', keys: 'j', run: () => moveFocus(1) },
      { id: 'task.prev', title: '이전 할 일로 이동', group: '할 일', keys: 'k', run: () => moveFocus(-1) },
      { id: 'task.complete', title: '완료 / 다시 열기', group: '할 일', keys: 'e', run: withTask((id) => { const t = state().entities.tasks[id]; if (t) t.status === 'done' ? actions.reopen(id) : actions.complete(id) }) },
      { id: 'task.select', title: '선택 토글', group: '할 일', keys: 'x', run: withTask((id) => ui().toggleSelected(id)) },
      { id: 'task.today', title: '오늘로 미루기', group: '할 일', keys: 's t', run: schedule(() => today()) },
      { id: 'task.tomorrow', title: '내일로 미루기', group: '할 일', keys: 's m', run: schedule(() => addDays(today(), 1)) },
      { id: 'task.nextweek', title: '다음 주로 미루기', group: '할 일', keys: 's w', run: schedule(() => nextWeekStart(today(), state().settings.weekStartsOn)) },
      { id: 'task.cleardate', title: '날짜 지우기', group: '할 일', keys: 's x', run: schedule(() => null) },
      { id: 'task.p1', title: '우선순위 1', group: '할 일', keys: 'y 1', run: priority(1) },
      { id: 'task.p2', title: '우선순위 2', group: '할 일', keys: 'y 2', run: priority(2) },
      { id: 'task.p3', title: '우선순위 3', group: '할 일', keys: 'y 3', run: priority(3) },
      { id: 'task.p4', title: '우선순위 없음', group: '할 일', keys: 'y 4', run: priority(4) },
      { id: 'task.pin', title: '고정 / 고정 해제', group: '할 일', keys: 'p', run: withTask((id) => { const t = state().entities.tasks[id]; if (t) actions.patch(id, { pinned: !t.pinned }) }) },
      { id: 'task.delete', title: '휴지통으로 보내기', group: '할 일', keys: 'mod+backspace', run: withTask((id) => {
        // 포커스한 행이 선택에 들어 있을 때만 선택 전체를 지운다(예전 화면에서 남은 선택을 잘못 지우지 않도록).
        const selected = ui().selectedIds
        const deletesSelection = selected.includes(id)
        actions.remove(deletesSelection ? [...selected] : [id])
        // 지운 할 일이 선택에 남으면 선택 바가 휴지통의 할 일을 가리킨 채 남는다.
        if (deletesSelection) ui().clearSelection()
      }) },
      { id: 'task.indent', title: '들여쓰기 (하위 작업으로)', group: '할 일', keys: 'mod+]', run: withTask((id) => actions.indent(id)) },
      { id: 'task.outdent', title: '내어쓰기 (한 단계 위로)', group: '할 일', keys: 'mod+[', run: withTask((id) => actions.outdent(id)) },
      { id: 'task.duplicate', title: '복제', group: '할 일', keys: 'mod+d', run: withTask((id) => { actions.duplicate(id) }) },

      { id: 'view.list', title: '목록 보기', group: '보기', keys: 'v l', run: setView('list') },
      { id: 'view.board', title: '칸반 보기', group: '보기', keys: 'v k', run: setView('board') },
      { id: 'view.calendar', title: '캘린더 보기', group: '보기', keys: 'v c', run: setView('calendar') },
      { id: 'view.timeline', title: '타임라인 보기', group: '보기', keys: 'v t', run: setView('timeline') },
      { id: 'view.matrix', title: '매트릭스 보기', group: '보기', keys: 'v m', run: setView('matrix') },

      { id: 'app.palette', title: '명령 팔레트 열기', group: '앱', keys: 'mod+k', run: () => ui().setPalette(true) },
      { id: 'app.help', title: '단축키 도움말', group: '앱', keys: '?', run: () => ui().setHelp(true) },
      { id: 'app.undo', title: '실행 취소', group: '앱', keys: 'mod+z', run: () => { const l = state().undo(); if (l) useToasts.getState().push(`되돌렸어요: ${l}`) } },
      { id: 'app.redo', title: '다시 실행', group: '앱', keys: 'mod+shift+z', run: () => { const l = state().redo(); if (l) useToasts.getState().push(`다시 실행했어요: ${l}`) } },
      { id: 'app.sidebar', title: '사이드바 열기 / 닫기', group: '앱', keys: 'm', run: () => ui().setSidebarOpen(!ui().sidebarOpen) },
      {
        id: 'app.theme',
        title: '테마 바꾸기 (자동 → 라이트 → 다크)',
        group: '앱',
        run: () => {
          const order = ['auto', 'light', 'dark'] as const
          const cur = state().settings.theme
          state().updateSettings({ theme: order[(order.indexOf(cur) + 1) % order.length] })
        },
      },
    ]
    return list
  }, [navigate, location.pathname, setParams, actions])
}

/** 사용자 지정 단축키를 반영한 최종 키. 빈 문자열이면 단축키를 끈 것이다. */
export function effectiveKeys(command: Command, overrides: Readonly<Record<string, string>>): string | undefined {
  const custom = overrides[command.id]
  if (custom === undefined) return command.keys
  return custom === '' ? undefined : custom
}
