import { useRef, useState } from 'react'
import type { AppData } from '../../domain/exchange'
import { todayOf } from '../../domain/date'
import type { MergeMode } from '../../domain/exchange'
import { db, useApp } from '../../store/app'
import { PALETTE } from '../../store/defaults'
import { newId } from '../../store/id'
import { useToasts } from '../../ui/toast'
import { analyzeImportText, checkImportSize } from './analyzeImport'
import type { ImportPlan } from './analyzeImport'
import { csvProjectName } from './format'
import { describeApplyFailure, syncAfterApply } from './applyResult'
import { buildCsvImportData, importAppData } from './importer'

const PROJECT_ORDER_STEP = 1000

function describe(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

function nextProjectOrder(): number {
  const projects = Object.values(useApp.getState().entities.projects)
  return projects.reduce((max, p) => Math.max(max, p.order), 0) + PROJECT_ORDER_STEP
}

type Analysis = { ok: true; plan: ImportPlan; warnings: string[] } | { ok: false; error: string }

/** 크기 확인 → 읽기 → JSON/CSV 판별까지. 실패는 한국어 문장으로 돌려준다. */
async function analyzeFile(file: File): Promise<Analysis> {
  const sizeProblem = checkImportSize(file.size)
  if (sizeProblem) return { ok: false, error: sizeProblem }
  let text: string
  try {
    text = await file.text()
  } catch (e: unknown) {
    return { ok: false, error: `파일을 읽지 못했어요. 다시 골라 주세요. (${describe(e)})` }
  }
  const now = Date.now()
  const today = todayOf(new Date(now), useApp.getState().settings.dayStartHour)
  const result = analyzeImportText(file.name, text, { nowMs: now, newId, today })
  return result.ok ? { ok: true, plan: result.value, warnings: result.warnings } : { ok: false, error: result.error }
}

function buildImportData(plan: ImportPlan, csvName: string, nowMs: number): AppData {
  if (plan.kind === 'json') return plan.data
  return buildCsvImportData(plan.parsed, {
    projectName: csvName,
    color: PALETTE[Object.keys(useApp.getState().entities.projects).length % PALETTE.length],
    order: nextProjectOrder(),
    nowMs,
    newId,
  })
}

/** DB 에 반영하고 메모리 상태를 다시 읽은 뒤, 사용자에게 보여 줄 완료 문구를 돌려준다. */
async function runImport(plan: ImportPlan, mode: MergeMode, csvName: string): Promise<string> {
  const nowMs = Date.now()
  const effectiveMode: MergeMode = plan.kind === 'csv' ? 'merge' : mode
  const summary = await importAppData(db, buildImportData(plan, csvName, nowMs), effectiveMode, { nowMs, newId })
  // 여기까지 오면 DB 는 이미 바뀌었다. 다른 탭에 알리고 이 탭도 다시 읽는다.
  await syncAfterApply()
  if (plan.kind === 'csv') return `할 일 ${plan.parsed.tasks.length}개를 새 프로젝트로 가져왔어요`
  if (effectiveMode === 'replace') return '백업 내용으로 바꿨어요'
  return `새 항목 ${summary.added}개를 더하고 ${summary.updated}개를 갱신했어요`
}

export interface ImportFlow {
  plan: ImportPlan | null
  warnings: string[]
  error: string | null
  busy: boolean
  mode: MergeMode
  csvName: string
  confirmingReplace: boolean
  setMode: (mode: MergeMode) => void
  setCsvName: (name: string) => void
  pickFile: (file: File) => Promise<void>
  cancel: () => void
  /** 덮어쓰기면 확인 대화상자를 먼저 연다. */
  requestApply: () => void
  apply: () => Promise<void>
  closeConfirm: () => void
}

/** 파일 선택 → 미리보기 → 병합/덮어쓰기 적용까지의 상태와 동작 */
export function useImportFlow(onApplied: () => void): ImportFlow {
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<MergeMode>('merge')
  const [csvName, setCsvName] = useState('')
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  // 파일을 연속해서 고르면 먼저 읽던 것이 나중 것을 덮지 않게 한다.
  const pickToken = useRef(0)

  const reset = (): void => {
    setPlan(null)
    setWarnings([])
    setError(null)
    setMode('merge')
    setConfirmingReplace(false)
  }

  const pickFile = async (file: File): Promise<void> => {
    const token = ++pickToken.current
    reset()
    const analysis = await analyzeFile(file)
    if (token !== pickToken.current) return
    if (!analysis.ok) return setError(analysis.error)
    setPlan(analysis.plan)
    setWarnings(analysis.warnings)
    setCsvName(csvProjectName(file.name))
  }

  const apply = async (): Promise<void> => {
    if (!plan) return
    setBusy(true)
    try {
      useToasts.getState().push(await runImport(plan, mode, csvName))
      reset()
      onApplied()
    } catch (e: unknown) {
      setConfirmingReplace(false)
      setError(describeApplyFailure(e, '가져오기'))
    } finally {
      setBusy(false)
    }
  }

  return {
    plan,
    warnings,
    error,
    busy,
    mode,
    csvName,
    confirmingReplace,
    setMode,
    setCsvName,
    pickFile,
    cancel: () => {
      pickToken.current += 1
      reset()
    },
    requestApply: () => (plan?.kind === 'json' && mode === 'replace' ? setConfirmingReplace(true) : void apply()),
    apply,
    closeConfirm: () => setConfirmingReplace(false),
  }
}
