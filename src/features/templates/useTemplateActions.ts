import { todayOf } from '../../domain/date'
import { INBOX_ID } from '../../domain/types'
import type { ID, ISODate, Template } from '../../domain/types'
import { useApp } from '../../store/app'
import { nextOrder } from '../../store/commands/taskTree'
import type { EntityState } from '../../store/changes'
import { newId } from '../../store/id'
import { useToasts } from '../../ui/toast'
import { buildProjectTemplate, buildTaskTemplate } from './build'
import { instantiateProjectTemplate, instantiateTaskTemplate } from './instantiate'

const ORDER_STEP = 1000

export interface TaskTarget {
  projectId?: ID
  sectionId?: ID | null
  /** 주면 이 작업의 하위 작업으로 만든다(프로젝트·섹션은 부모를 따른다) */
  parentId?: ID | null
  /** 템플릿의 오프셋을 풀어 쓸 기준일. 기본은 오늘 */
  baseDate?: ISODate
}

export interface ProjectTarget {
  name?: string
  parentId?: ID | null
  baseDate?: ISODate
}

interface Placement {
  projectId: ID
  sectionId: ID | null
  parentId: ID | null
}

function resolvePlacement(state: EntityState, defaultProjectId: ID, target: TaskTarget): Placement {
  const parent = target.parentId ? state.tasks[target.parentId] : undefined
  if (parent) return { projectId: parent.projectId, sectionId: parent.sectionId, parentId: parent.id }

  const wanted = target.projectId ?? defaultProjectId
  const project = state.projects[wanted]
  const projectId = project && project.deletedAt === null && !project.isFolder ? wanted : INBOX_ID
  const section = target.sectionId ? state.sections[target.sectionId] : undefined
  return { projectId, sectionId: section && section.projectId === projectId ? section.id : null, parentId: null }
}

const state = () => useApp.getState()
const fail = (message: string): void => useToasts.getState().push(message, { tone: 'error' })
const undoToast = (message: string): void =>
  useToasts.getState().push(message, { actionLabel: '되돌리기', onAction: () => state().undo() })
const today = (): ISODate => todayOf(new Date(), state().settings.dayStartHour)
const knownLabelIds = (): ReadonlySet<ID> => new Set(Object.keys(state().entities.labels))

function find(templateId: ID): Template | null {
  const template = state().entities.templates[templateId]
  if (template) return template
  fail('템플릿을 찾지 못했어요')
  return null
}

function save(template: Template | null, missingMessage: string): Template | null {
  if (!template) {
    fail(missingMessage)
    return null
  }
  state().commit({ puts: { templates: [template] }, deletes: {} }, '템플릿 저장')
  undoToast(`"${template.name}" 템플릿으로 저장했어요`)
  return template
}

/** 작업과 하위 작업을 템플릿으로 저장한다. 이름을 비우면 작업 제목을 쓴다. */
function saveTask(taskId: ID, name = ''): Template | null {
  return save(buildTaskTemplate(state().entities, taskId, name, Date.now()), '템플릿으로 저장할 할 일을 찾지 못했어요')
}

/** 프로젝트의 섹션과 할 일을 템플릿으로 저장한다. */
function saveProject(projectId: ID, name = ''): Template | null {
  return save(buildProjectTemplate(state().entities, projectId, name, Date.now()), '템플릿으로 저장할 프로젝트를 찾지 못했어요')
}

/** 작업 템플릿으로 할 일을 만든다. 만든 할 일 개수를 돌려주고, 실패하면 0이다. */
function createTasks(templateId: ID, target: TaskTarget = {}): number {
  const template = find(templateId)
  if (!template) return 0
  if (template.kind !== 'task') {
    fail('프로젝트 템플릿은 새 프로젝트로 불러올 수 있어요')
    return 0
  }
  const { entities, settings } = state()
  const place = resolvePlacement(entities, settings.defaultProjectId, target)
  const changes = instantiateTaskTemplate(template, {
    ...place,
    baseDate: target.baseDate ?? today(),
    nowMs: Date.now(),
    newId,
    rootOrder: nextOrder(entities, place.projectId, place.parentId),
    knownLabelIds: knownLabelIds(),
  })
  const count = changes.puts.tasks?.length ?? 0
  if (count === 0) {
    fail('템플릿 내용을 읽지 못했어요')
    return 0
  }
  state().commit(changes, '템플릿에서 할 일 추가')
  undoToast(count > 1 ? `할 일 ${count}개를 만들었어요` : '할 일을 만들었어요')
  return count
}

/** 프로젝트 템플릿으로 새 프로젝트를 만든다. 새 프로젝트 id 를 돌려주고, 실패하면 null 이다. */
function createProject(templateId: ID, target: ProjectTarget = {}): ID | null {
  const template = find(templateId)
  if (!template) return null
  if (template.kind !== 'project') {
    fail('작업 템플릿은 할 일로 불러올 수 있어요')
    return null
  }
  const parentId = target.parentId ?? null
  const siblings = Object.values(state().entities.projects).filter((p) => p.parentId === parentId)
  const result = instantiateProjectTemplate(template, {
    parentId,
    name: target.name,
    baseDate: target.baseDate ?? today(),
    nowMs: Date.now(),
    newId,
    order: siblings.reduce((max, p) => Math.max(max, p.order), 0) + ORDER_STEP,
    knownLabelIds: knownLabelIds(),
  })
  if (result.projectId === null) {
    fail('템플릿 내용을 읽지 못했어요')
    return null
  }
  state().commit(result.changes, '템플릿에서 프로젝트 추가')
  undoToast('프로젝트를 만들었어요')
  return result.projectId
}

function rename(templateId: ID, name: string): void {
  const template = state().entities.templates[templateId]
  const trimmed = name.trim()
  if (!template || trimmed === '' || trimmed === template.name) return
  state().commit({ puts: { templates: [{ ...template, name: trimmed }] }, deletes: {} }, '템플릿 이름 변경')
}

function remove(templateId: ID): void {
  const template = state().entities.templates[templateId]
  if (!template) return
  state().commit({ puts: {}, deletes: { templates: [templateId] } }, '템플릿 삭제')
  undoToast(`"${template.name}" 템플릿을 지웠어요`)
}

const templateActions = { saveTask, saveProject, createTasks, createProject, rename, remove }

export type TemplateActions = typeof templateActions

/**
 * 템플릿 저장·불러오기 모음. 상세 패널과 명령 팔레트가 이 훅으로 템플릿 기능을 연결한다.
 * 모든 쓰기는 commit 을 거치므로 실행 취소가 된다. 항상 같은 객체를 돌려주므로 의존성 배열에 넣어도 안전하다.
 */
export function useTemplateActions(): TemplateActions {
  return templateActions
}
