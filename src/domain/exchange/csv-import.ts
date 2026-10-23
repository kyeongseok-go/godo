// Todoist CSV 가져오기. 문자열을 받아 작업·섹션 목록을 돌려줄 뿐 저장은 호출 측 몫이다.
import { addDays, isISODate, isTimeOfDay } from '../date'
import type { ID, ISODate, Priority, Section, Task, TimeOfDay } from '../types'
import { parseCsvRows, unguardFormulaCell } from './csv-core'
import { failure, type AppData, type ImportResult } from './model'

export interface CsvImportOptions {
  projectName: string
  nowMs: number
  newId: () => ID
  today: ISODate
}

type CsvImportValue = Pick<AppData, 'tasks' | 'sections'> & { projectName: string }

interface CsvRow {
  cells: readonly string[]
  number: number // 1부터 세는 레코드 번호(헤더가 1)
}

interface ImportState {
  tasks: Task[]
  sections: Section[]
  warnings: string[]
  currentSectionId: ID | null
  ancestors: ID[] // 현재 줄까지 이어지는 부모 사슬. 맨 끝이 가장 가까운 상위
  siblingCounts: Map<string, number>
  unsupportedRows: number
  emptyRows: number
}

const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?$/
const MISSING_COLUMNS = 'CSV 헤더에서 TYPE, CONTENT 열을 찾지 못했어요. Todoist 형식의 CSV가 맞는지 확인해 주세요.'

function locateColumns(header: readonly string[]): ReadonlyMap<string, number> | null {
  const columns = new Map<string, number>()
  header.forEach((name, index) => {
    const key = name.trim().toUpperCase()
    if (!columns.has(key)) columns.set(key, index)
  })
  return columns.has('TYPE') && columns.has('CONTENT') ? columns : null
}

function parsePriority(raw: string): Priority {
  const trimmed = raw.trim()
  if (!/^[1-4]$/.test(trimmed)) return 4
  return Number(trimmed) as Priority
}

function parseIndent(raw: string): number {
  const trimmed = raw.trim()
  const value = /^\d+$/.test(trimmed) ? Number(trimmed) : 1
  return Math.max(1, value)
}

/** 해석하지 못하면 null. 오늘·내일 같은 상대 표현만 today 를 기준으로 풀어 준다. */
function parseDateCell(raw: string, today: ISODate): { startDate: ISODate; startTime: TimeOfDay | null } | null {
  const value = raw.trim()
  const match = DATE_PATTERN.exec(value)
  if (match) {
    const [, date, time] = match
    if (!isISODate(date)) return null
    if (time !== undefined && !isTimeOfDay(time)) return null
    return { startDate: date, startTime: time ?? null }
  }

  const keyword = value.toLowerCase()
  if (keyword === 'today' || keyword === '오늘') return { startDate: today, startTime: null }
  if (keyword === 'tomorrow' || keyword === '내일') return { startDate: addDays(today, 1), startTime: null }
  return null
}

function nextOrder(state: ImportState, parentId: ID | null): number {
  const key = `${state.currentSectionId ?? ''}|${parentId ?? ''}`
  const order = state.siblingCounts.get(key) ?? 0
  state.siblingCounts.set(key, order + 1)
  return order
}

/** INDENT 가 갑자기 깊어져도 바로 위 작업의 자식으로 붙도록 깊이를 사슬 길이 + 1 로 제한한다. */
function resolveParent(state: ImportState, indent: number): ID | null {
  const depth = Math.min(indent, state.ancestors.length + 1)
  state.ancestors = state.ancestors.slice(0, depth - 1)
  return state.ancestors[state.ancestors.length - 1] ?? null
}

function buildTask(opts: CsvImportOptions, fields: Pick<Task, 'title' | 'description' | 'priority' | 'sectionId' | 'parentId' | 'order' | 'startDate' | 'startTime'>): Task {
  return {
    id: opts.newId(),
    ...fields,
    // 프로젝트 ID 를 이 함수는 모른다. 호출 측이 새 프로젝트를 만든 뒤 채운다.
    projectId: '',
    labelIds: [],
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
    createdAt: opts.nowMs,
    updatedAt: opts.nowMs,
    completedAt: null,
    deletedAt: null,
  }
}

function addSection(state: ImportState, opts: CsvImportOptions, name: string): void {
  state.sections.push({
    id: opts.newId(),
    projectId: '', // 호출 측이 채운다
    name,
    order: state.sections.length,
    category: null,
  })
  state.currentSectionId = state.sections[state.sections.length - 1].id
  state.ancestors = [] // 하위 작업은 섹션 경계를 넘지 않는다
}

function addTask(state: ImportState, opts: CsvImportOptions, row: CsvRow, get: (column: string) => string, title: string): void {
  const parentId = resolveParent(state, parseIndent(get('INDENT')))
  const rawDate = get('DATE').trim()
  const date = rawDate === '' ? null : parseDateCell(rawDate, opts.today)
  if (rawDate !== '' && date === null) {
    state.warnings.push(`${row.number}번째 행: 날짜 "${rawDate}"를 해석하지 못해 비웠어요`)
  }

  const task = buildTask(opts, {
    title,
    description: unguardFormulaCell(get('DESCRIPTION')),
    priority: parsePriority(get('PRIORITY')),
    sectionId: state.currentSectionId,
    parentId,
    order: nextOrder(state, parentId),
    startDate: date?.startDate ?? null,
    startTime: date?.startTime ?? null,
  })
  state.tasks.push(task)
  state.ancestors = [...state.ancestors, task.id]
}

function processRow(state: ImportState, opts: CsvImportOptions, columns: ReadonlyMap<string, number>, row: CsvRow): void {
  const get = (column: string): string => {
    const index = columns.get(column)
    return index === undefined ? '' : (row.cells[index] ?? '')
  }

  const type = get('TYPE').trim().toLowerCase()
  if (type === 'meta') return
  if (type !== 'task' && type !== 'section') {
    state.unsupportedRows += 1
    return
  }

  const content = unguardFormulaCell(get('CONTENT')).trim()
  if (content === '') {
    state.emptyRows += 1
    return
  }
  if (type === 'section') addSection(state, opts, content)
  else addTask(state, opts, row, get, content)
}

/**
 * 반환하는 작업·섹션의 projectId 는 ''(빈 문자열)이다. 이 함수는 프로젝트 ID 를 모르므로
 * 호출 측이 프로젝트를 만든 뒤 채워야 한다. 반복 규칙·라벨은 복원하지 않는다.
 */
export function parseTodoistCsv(text: string, opts: CsvImportOptions): ImportResult<CsvImportValue> {
  const rows: CsvRow[] = parseCsvRows(text)
    .map((cells, index) => ({ cells, number: index + 1 }))
    .filter((row) => row.cells.some((cell) => cell.trim() !== ''))

  if (rows.length === 0) return failure('CSV 파일이 비어 있어요.')
  const columns = locateColumns(rows[0].cells)
  if (!columns) return failure(MISSING_COLUMNS)

  const state: ImportState = {
    tasks: [],
    sections: [],
    warnings: [],
    currentSectionId: null,
    ancestors: [],
    siblingCounts: new Map(),
    unsupportedRows: 0,
    emptyRows: 0,
  }
  for (const row of rows.slice(1)) processRow(state, opts, columns, row)

  const warnings = [...state.warnings]
  if (state.unsupportedRows > 0) warnings.push(`지원하지 않는 행 ${state.unsupportedRows}개를 건너뛰었어요`)
  if (state.emptyRows > 0) warnings.push(`내용이 없는 행 ${state.emptyRows}개를 건너뛰었어요`)

  return { ok: true, value: { tasks: state.tasks, sections: state.sections, projectName: opts.projectName }, warnings }
}
