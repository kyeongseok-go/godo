import { useMemo } from 'react'
import type { ISODate, Label, Project } from '../../domain/types'
import type { TaskNode } from '../../domain/views'
import { useSettings, useToday } from '../../hooks/data'
import type { Lookups } from '../../hooks/lookups'
import { buildTask } from '../../store/commands/taskFactory'
import { TaskRow } from '../tasks/TaskRow'

const PROJECT: Project = {
  id: 'preview-project',
  name: '업무',
  color: '#2b4c7e',
  icon: null,
  parentId: null,
  isFolder: false,
  archived: false,
  favorite: false,
  defaultView: 'list',
  order: 0,
  createdAt: 0,
  deletedAt: null,
}

const LABEL: Label = { id: 'preview-label', name: '집중필요', color: '#2f6f5e', order: 0 }

const LOOKUPS: Lookups = {
  projects: new Map([[PROJECT.id, PROJECT]]),
  sections: new Map(),
  labels: new Map([[LABEL.id, LABEL]]),
}

const noop = (): void => undefined

function previewNode(today: ISODate): TaskNode {
  const task = buildTask(
    { title: '분기 보고서 초안 작성', projectId: PROJECT.id, priority: 1, startDate: today, startTime: '10:00', durationMin: 90, estimateMin: 90, labelIds: [LABEL.id] },
    0,
    'preview-task',
  )
  return { task, children: [], depth: 0 }
}

/** 지금 고른 테마·강조색·밀도가 실제 할 일 행에서 어떻게 보이는지 한 줄로 보여 준다. 만질 수 없다. */
export function AppearancePreview() {
  const settings = useSettings()
  const today = useToday()
  const node = useMemo(() => previewNode(today), [today])

  return (
    <aside className="st-preview" aria-label="미리보기">
      <p className="st-preview__eyebrow">미리보기</p>
      <div className="st-preview__row" role="list" inert>
        <TaskRow
          node={node}
          today={today}
          settings={settings}
          showProject
          collapsed={false}
          selected={false}
          focused={false}
          onToggleDone={noop}
          onOpen={noop}
          onToggleCollapse={noop}
          onToggleSelect={noop}
          lookups={LOOKUPS}
        />
      </div>
      <div className="st-preview__samples" aria-hidden="true">
        <span className="st-preview__button">작업 추가</span>
        <span className="st-preview__link">강조색 글자</span>
      </div>
    </aside>
  )
}
