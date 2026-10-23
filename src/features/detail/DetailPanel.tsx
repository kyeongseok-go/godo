import { BookmarkPlus, Copy, Flag, Hourglass, Link2, MoreHorizontal, Pin, PinOff, SkipForward, Timer, Trash2, Undo2, X, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../../domain/format'
import { useSettings, useTable } from '../../hooks/data'
import { useTaskActions } from '../../hooks/actions'
import { useOpenTask } from '../../hooks/openTask'
import { paths } from '../../app/nav'
import { useTemplateActions } from '../templates'
import { Checkbox } from '../../ui/Checkbox'
import { Menu } from '../../ui/Menu'
import type { MenuEntry } from '../../ui/Menu'
import { useToasts } from '../../ui/toast'
import { DateButton, LabelButton, PriorityButton, ProjectButton } from '../pickers/PickerButtons'
import { ActivitySection } from './ActivitySection'
import { CommentSection } from './CommentSection'
import { DependencySection } from './DependencySection'
import { DescriptionField } from './DescriptionField'
import { ReminderSection } from './ReminderSection'
import { SubtaskSection } from './SubtaskSection'
import './detail.css'

const ESTIMATES = [15, 30, 60, 120] as const

export function DetailPanel() {
  const { openId, close } = useOpenTask()
  const tasks = useTable('tasks')
  const task = useMemo(() => tasks.find((t) => t.id === openId) ?? null, [tasks, openId])
  const open = Boolean(openId && task)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open], .popover')) close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <aside
      ref={panelRef}
      className="detail"
      data-open={open}
      aria-hidden={!open}
      aria-label="할 일 상세"
      tabIndex={-1}
      // 닫혀 있을 땐 탭 순서에서도 빠져야 한다.
      {...(open ? {} : { inert: true })}
    >
      {task ? <DetailBody key={task.id} taskId={task.id} allTasks={tasks} onClose={close} /> : null}
    </aside>
  )
}

interface DetailBodyProps {
  taskId: string
  allTasks: ReturnType<typeof useTable<'tasks'>>
  onClose: () => void
}

function DetailBody({ taskId, allTasks, onClose }: DetailBodyProps) {
  const task = allTasks.find((t) => t.id === taskId)
  const actions = useTaskActions()
  const settings = useSettings()
  const navigate = useNavigate()
  const templates = useTemplateActions()
  const projects = useTable('projects')
  const moreRef = useRef<HTMLButtonElement>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [title, setTitle] = useState(task?.title ?? '')
  // Esc 로 취소하며 blur() 를 부르면 onBlur 가 아직 바뀌기 전의 title 로 저장해 버린다. 그 한 번을 건너뛴다.
  const cancelingRef = useRef(false)

  useEffect(() => {
    if (task) setTitle(task.title)
  }, [task?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null
  const trashed = task.deletedAt !== null
  const done = task.status === 'done'
  const project = projects.find((p) => p.id === task.projectId)
  const patch = (p: Partial<typeof task>, label?: string) => actions.patch(task.id, p, label)
  const actualTotal = Object.values(task.actualMin).reduce((a, b) => a + b, 0)

  const saveTitle = () => {
    if (cancelingRef.current) {
      cancelingRef.current = false
      return
    }
    const next = title.trim()
    if (!next) return setTitle(task.title)
    if (next !== task.title) patch({ title: next }, '제목 수정')
  }

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#/inbox?task=${task.id}`
    try {
      await navigator.clipboard.writeText(url)
      useToasts.getState().push('링크를 복사했어요')
    } catch {
      useToasts.getState().push('링크를 복사하지 못했어요', { tone: 'error' })
    }
  }

  const entries: MenuEntry[] = trashed
    ? [
        { kind: 'item', id: 'restore', label: '복원', icon: <Undo2 size={14} />, onSelect: () => actions.restore(task.id) },
        { kind: 'item', id: 'purge', label: '영구 삭제', icon: <Trash2 size={14} />, danger: true, onSelect: () => { actions.purge([task.id]); onClose() } },
      ]
    : [
        { kind: 'item', id: 'pin', label: task.pinned ? '고정 해제' : '상단에 고정', icon: task.pinned ? <PinOff size={14} /> : <Pin size={14} />, onSelect: () => patch({ pinned: !task.pinned }) },
        { kind: 'item', id: 'focus', label: '집중 시작', icon: <Timer size={14} />, onSelect: () => navigate(`${paths.focus}?task=${task.id}`) },
        { kind: 'item', id: 'dup', label: '복제', icon: <Copy size={14} />, onSelect: () => { const id = actions.duplicate(task.id); if (id) useToasts.getState().push('복제했어요') } },
        { kind: 'item', id: 'tpl', label: '템플릿으로 저장', icon: <BookmarkPlus size={14} />, onSelect: () => { templates.saveTask(task.id) } },
        { kind: 'item', id: 'link', label: '링크 복사', icon: <Link2 size={14} />, onSelect: () => void copyLink() },
        ...(task.recurrence ? [{ kind: 'item' as const, id: 'skip', label: '이번 회차 건너뛰기', icon: <SkipForward size={14} />, onSelect: () => actions.skip(task.id) }] : []),
        { kind: 'separator', id: 'sep' },
        { kind: 'item', id: 'cancel', label: '계획 취소', icon: <XCircle size={14} />, disabled: task.status === 'canceled', onSelect: () => actions.cancel(task.id) },
        { kind: 'item', id: 'del', label: '휴지통으로', icon: <Trash2 size={14} />, danger: true, onSelect: () => { actions.remove([task.id]); onClose() } },
      ]

  return (
    <>
      <header className="detail__head">
        <Checkbox
          checked={done}
          canceled={task.status === 'canceled'}
          priority={task.priority}
          label={done ? '완료 취소' : '완료'}
          onChange={(next) => (next ? actions.complete(task.id) : actions.reopen(task.id))}
        />
        <span className="detail__crumb">
          {project ? <><i className="dot" style={{ background: project.color }} aria-hidden="true" />{project.name}</> : null}
        </span>
        <button ref={moreRef} type="button" className="icon-btn" aria-label="더 보기" aria-haspopup="menu" onClick={() => setMoreOpen((v) => !v)}>
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
        <Menu open={moreOpen} anchorRef={moreRef} onClose={() => setMoreOpen(false)} entries={entries} label="작업 메뉴" align="end" />
      </header>

      {trashed ? <p className="detail__banner">휴지통에 있어요. 복원하면 다시 목록에 나타납니다.</p> : null}

      <div className="detail__scroll">
        <input
          className="detail__title"
          value={title}
          aria-label="제목"
          disabled={trashed}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') {
              e.stopPropagation()
              cancelingRef.current = true
              setTitle(task.title)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />

        <fieldset className="detail__fields" disabled={trashed}>
          <div className="field">
            <span className="field__label">날짜</span>
            <DateButton
              variant="field"
              placeholder="날짜 없음"
              value={{ startDate: task.startDate, startTime: task.startTime, durationMin: task.durationMin, dayPart: task.dayPart, recurrence: task.recurrence, someday: task.someday }}
              onChange={(p) => patch(p, '일정 수정')}
            />
          </div>
          <div className="field">
            <span className="field__label">마감</span>
            <div className="field__inline">
              <Flag size={14} aria-hidden="true" />
              <input
                type="date"
                aria-label="마감일"
                value={task.dueDate ?? ''}
                onChange={(e) => patch({ dueDate: e.target.value || null }, '마감일 수정')}
              />
              {task.dueDate ? (
                <button type="button" className="icon-btn" aria-label="마감일 지우기" onClick={() => patch({ dueDate: null }, '마감일 수정')}>
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="field">
            <span className="field__label">우선순위</span>
            <PriorityButton variant="field" value={task.priority} onChange={(priority) => patch({ priority }, '우선순위 수정')} />
          </div>
          <div className="field">
            <span className="field__label">프로젝트</span>
            <ProjectButton variant="field" projectId={task.projectId} sectionId={task.sectionId} onChange={(projectId, sectionId) => actions.move(task.id, { projectId, sectionId, parentId: task.parentId })} />
          </div>
          <div className="field">
            <span className="field__label">라벨</span>
            <LabelButton variant="field" labelIds={task.labelIds} onChange={(labelIds) => patch({ labelIds }, '라벨 수정')} />
          </div>
          <div className="field">
            <span className="field__label">예상 시간</span>
            <div className="field__inline">
              <Hourglass size={14} aria-hidden="true" />
              {ESTIMATES.map((m) => (
                <button key={m} type="button" className="chip-btn" data-active={task.estimateMin === m} onClick={() => patch({ estimateMin: task.estimateMin === m ? null : m }, '예상 시간 수정')}>
                  {formatDuration(m)}
                </button>
              ))}
              <input
                type="number"
                min={0}
                step={5}
                className="field__num"
                aria-label="예상 시간(분)"
                placeholder="분"
                value={task.estimateMin ?? ''}
                onChange={(e) => patch({ estimateMin: e.target.value ? Math.max(0, Number(e.target.value)) : null }, '예상 시간 수정')}
              />
            </div>
            {actualTotal > 0 ? <p className="field__note">실제 {formatDuration(actualTotal)} 사용</p> : null}
          </div>
        </fieldset>

        <DescriptionField value={task.description} onCommit={(description) => patch({ description }, '설명 수정')} />
        <SubtaskSection parent={task} allTasks={allTasks} />
        <ReminderSection task={task} onChange={(p) => patch(p, '알림 수정')} />
        <DependencySection task={task} allTasks={allTasks} onChange={(p) => patch(p, '시작 조건 수정')} />
        <CommentSection taskId={task.id} />
        <ActivitySection taskId={task.id} />

        <footer className="detail__foot">
          <span>만든 날 {new Date(task.createdAt).toLocaleDateString('ko-KR')}</span>
          {settings.timeFormat ? null : null}
          {task.postponeCount > 0 ? <span>{task.postponeCount}번 미룸</span> : null}
        </footer>
      </div>
    </>
  )
}
