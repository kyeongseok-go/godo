// 고른 파일의 글자를 읽어 JSON 백업인지 Todoist CSV 인지 판별하고 검증한다. 파일·DOM 에는 접근하지 않는다.
import { parseBackup, parseTodoistCsv } from '../../domain/exchange'
import type { AppData, ImportResult } from '../../domain/exchange'
import type { ID, ISODate, Section, Task } from '../../domain/types'
import { csvProjectName } from './format'

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024

export type ImportPlan =
  | { kind: 'json'; fileName: string; data: AppData; exportedAt: string }
  | { kind: 'csv'; fileName: string; parsed: { tasks: Task[]; sections: Section[] } }

export interface AnalyzeContext {
  nowMs: number
  today: ISODate
  newId: () => ID
}

export function checkImportSize(bytes: number): string | null {
  if (bytes <= 0) return '빈 파일이에요. 다른 파일을 골라 주세요.'
  if (bytes > MAX_IMPORT_BYTES) return `파일이 너무 커요. ${MAX_IMPORT_BYTES / 1024 / 1024}MB 이하의 파일만 가져올 수 있어요.`
  return null
}

function analyzeJson(fileName: string, text: string): ImportResult<ImportPlan> {
  const parsed = parseBackup(text)
  if (!parsed.ok) return parsed
  const { data, exportedAt } = parsed.value
  return { ok: true, value: { kind: 'json', fileName, data, exportedAt }, warnings: parsed.warnings }
}

function analyzeCsv(fileName: string, text: string, ctx: AnalyzeContext): ImportResult<ImportPlan> {
  const parsed = parseTodoistCsv(text, { projectName: csvProjectName(fileName), nowMs: ctx.nowMs, newId: ctx.newId, today: ctx.today })
  if (!parsed.ok) return parsed
  const { tasks, sections } = parsed.value
  return { ok: true, value: { kind: 'csv', fileName, parsed: { tasks, sections } }, warnings: parsed.warnings }
}

/** 확장자가 .csv 면 CSV, 그 밖에는 JSON 백업으로 읽는다. */
export function analyzeImportText(fileName: string, text: string, ctx: AnalyzeContext): ImportResult<ImportPlan> {
  if (text.trim() === '') return { ok: false, error: '파일 내용이 비어 있어요.' }
  return /\.csv$/i.test(fileName) ? analyzeCsv(fileName, text, ctx) : analyzeJson(fileName, text)
}
