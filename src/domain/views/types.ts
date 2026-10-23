import type { Task } from '../types'

export type GroupBy =
  | 'none'
  | 'date'
  | 'createdAt'
  | 'dueDate'
  | 'priority'
  | 'label'
  | 'project'
  | 'section'

export type SortBy =
  | 'manual'
  | 'name'
  | 'date'
  | 'priority'
  | 'createdAt'
  | 'updatedAt'
  | 'dueDate'

export type SortDir = 'asc' | 'desc'

export interface TaskGroup {
  key: string
  /** 화면에 그대로 보여주는 한국어 제목 */
  title: string
  tasks: Task[]
}

export interface TaskNode {
  task: Task
  children: TaskNode[]
  /** 최상위는 0 */
  depth: number
}

export type Quadrant = 'doFirst' | 'schedule' | 'delegate' | 'eliminate'
