// 테스트용 팩토리. 모든 도메인 테스트가 같은 기본값을 쓰도록 한 곳에 둔다.
import { INBOX_ID } from '../domain/types'
import type { Label, Project, Section, Task } from '../domain/types'

let seq = 0
const nextId = (prefix: string): string => `${prefix}${++seq}`

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId('t'),
    title: '할 일',
    description: '',
    projectId: INBOX_ID,
    sectionId: null,
    parentId: null,
    priority: 4,
    labelIds: [],
    startDate: null,
    startTime: null,
    durationMin: null,
    dayPart: null,
    dueDate: null,
    estimateMin: null,
    actualMin: {},
    recurrence: null,
    reminders: [],
    persistentReminder: false,
    status: 'todo',
    blockedBy: [],
    onHold: false,
    someday: false,
    postponeCount: 0,
    pinned: false,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
    deletedAt: null,
    ...overrides,
  }
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId('p'),
    name: '프로젝트',
    color: '#d9421c',
    icon: null,
    parentId: null,
    isFolder: false,
    archived: false,
    favorite: false,
    defaultView: 'list',
    order: 0,
    createdAt: 0,
    deletedAt: null,
    ...overrides,
  }
}

export function makeSection(overrides: Partial<Section> = {}): Section {
  return {
    id: nextId('s'),
    projectId: INBOX_ID,
    name: '섹션',
    order: 0,
    category: null,
    ...overrides,
  }
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return { id: nextId('l'), name: '라벨', color: '#2f6f5e', order: 0, ...overrides }
}
