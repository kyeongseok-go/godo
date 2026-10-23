// AST를 작업 하나에 대해 평가한다. 상태 게이트(삭제·완료 제외)는 engine.ts 가 맡고 여기는 조건만 본다.
import { compareDate, toISODate } from '../date'
import type { ISODate, Task } from '../types'
import type { CompareOp, DateField, FilterNode, FlagName, NodeOf } from './ast'
import type { Runtime } from './runtime'

/** "할 날" 기준 날짜. 시작일이 없으면 마감일을 대신 쓴다. */
const effectiveDate = (task: Task): ISODate | null => task.startDate ?? task.dueDate

const isOpen = (task: Task): boolean => task.status === 'todo' || task.status === 'active'

export function evalNode(node: FilterNode, task: Task, rt: Runtime): boolean {
  switch (node.type) {
    case 'and':
      return node.children.every((child) => evalNode(child, task, rt))
    case 'or':
      return node.children.some((child) => evalNode(child, task, rt))
    case 'not':
      return !evalNode(node.child, task, rt)
    default:
      return evalLeaf(node, task, rt)
  }
}

type LeafNode = Exclude<FilterNode, NodeOf<'and'> | NodeOf<'or'> | NodeOf<'not'>>

function evalLeaf(node: LeafNode, task: Task, rt: Runtime): boolean {
  switch (node.type) {
    case 'date':
      return evalDate(node, task, rt)
    case 'dateWindow':
      return evalWindow(node, task, rt)
    case 'overdue': {
      const date = effectiveDate(task)
      return date !== null && isOpen(task) && compareDate(date, rt.today) < 0
    }
    case 'noDate':
      return effectiveDate(task) === null
    case 'noTime':
      return task.startTime === null
    case 'noDeadline':
      return task.dueDate === null
    case 'noLabels':
      return task.labelIds.length === 0
    case 'priority':
      return task.priority === node.level
    case 'project':
      return rt.projectIds(node).has(task.projectId)
    case 'section':
      return task.sectionId !== null && rt.sectionIds(node).has(task.sectionId)
    case 'label': {
      const wanted = rt.labelIds(node)
      return task.labelIds.some((id) => wanted.has(id))
    }
    case 'flag':
      return evalFlag(node.flag, task, rt)
    case 'compare':
      return evalCompare(node, task)
    case 'search':
      return (
        task.title.toLowerCase().includes(node.needle) ||
        task.description.toLowerCase().includes(node.needle)
      )
  }
}

function fieldDate(field: DateField, task: Task): ISODate | null {
  switch (field) {
    case 'date':
      return effectiveDate(task)
    case 'deadline':
      return task.dueDate
    case 'created':
      return toISODate(new Date(task.createdAt))
  }
}

function evalDate(node: NodeOf<'date'>, task: Task, rt: Runtime): boolean {
  const value = fieldDate(node.field, task)
  if (value === null) return false
  const target = rt.resolveDate(node.value)
  const order = compareDate(value, target)
  if (node.op === 'on') return order === 0
  return node.op === 'before' ? order < 0 : order > 0
}

function evalWindow(node: NodeOf<'dateWindow'>, task: Task, rt: Runtime): boolean {
  const date = effectiveDate(task)
  if (date === null) return false
  const [from, to] = rt.windowBounds(node)
  return compareDate(date, from) >= 0 && compareDate(date, to) <= 0
}

function evalFlag(flag: FlagName, task: Task, rt: Runtime): boolean {
  switch (flag) {
    case 'recurring':
      return task.recurrence !== null
    case 'subtask':
      return task.parentId !== null
    case 'blocked':
      return task.blockedBy.some((id) => rt.isUnresolved(id))
    case 'hold':
      return task.onHold
    case 'someday':
      return task.someday
    case 'pinned':
      return task.pinned
    case 'completed':
      return task.status === 'done'
    case 'canceled':
      return task.status === 'canceled'
    case 'viewAll':
    case 'all':
      return true
  }
}

function compareNumbers(actual: number, op: CompareOp, expected: number): boolean {
  switch (op) {
    case '<':
      return actual < expected
    case '<=':
      return actual <= expected
    case '=':
      return actual === expected
    case '>=':
      return actual >= expected
    case '>':
      return actual > expected
  }
}

function evalCompare(node: NodeOf<'compare'>, task: Task): boolean {
  if (node.field === 'postponed') return compareNumbers(task.postponeCount, node.op, node.value)
  // 예상 시간이 없는 작업은 크기를 모르므로 어떤 비교에도 맞지 않는다.
  return task.estimateMin !== null && compareNumbers(task.estimateMin, node.op, node.value)
}
