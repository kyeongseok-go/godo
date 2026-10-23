// 빠른 입력 파서 본체: 인식기를 정해진 순서로 돌리고, 시작일을 보정하고, 제목을 만든다.
import { addDays, minutesOfDay } from '../date'
import { recognizeBracedDeadline, recognizeWordDeadline } from './deadline'
import { recognizeDate } from './dates'
import { recognizeDayPart } from './dayPart'
import { recognizeEstimate, recognizeReminders } from './durationSymbols'
import { firstOccurrence } from './firstOccurrence'
import { protectedSpans } from './protect'
import { recognizeRecurrence } from './recurrence'
import { applyHits, emptyFields, type Fields, type Recognizer, type State } from './state'
import { recognizeLabels, recognizePriority, recognizeProject, recognizeSection } from './symbols'
import { recognizeTime } from './times'
import { buildTitle } from './title'
import type { ParseContext, ParsedQuickAdd } from './types'

/** 기호 인식기. parseDates와 상관없이 항상 돈다. */
const SYMBOL_RECOGNIZERS: readonly Recognizer[] = [
  recognizeProject,
  recognizeSection,
  recognizeLabels,
  recognizePriority,
  recognizeEstimate,
  recognizeReminders,
  recognizeBracedDeadline,
]

/**
 * 자연어 인식기. 순서가 곧 우선순위다:
 * 반복(매주 월요일)이 날짜(월요일)보다, 마감 구절(금요일까지)이 일반 날짜보다, 시각이 하루 구간 단어보다 먼저다.
 */
const NATURAL_RECOGNIZERS: readonly Recognizer[] = [
  recognizeRecurrence,
  recognizeWordDeadline,
  recognizeTime,
  recognizeDate,
  recognizeDayPart,
]

function runAll(input: string, ctx: ParseContext): State {
  const recognizers = ctx.parseDates ? [...SYMBOL_RECOGNIZERS, ...NATURAL_RECOGNIZERS] : SYMBOL_RECOGNIZERS
  const initial: State = {
    claimed: protectedSpans(input),
    tokens: [],
    fields: emptyFields(),
  }
  return recognizers.reduce((state, recognize) => applyHits(state, recognize(input, state, ctx)), initial)
}

/** 날짜 없이 시각만 있으면 오늘(이미 지났으면 내일), 반복만 있으면 첫 회차를 시작일로 채운다. */
function fillStartDate(fields: Fields, ctx: ParseContext): string | null {
  if (fields.startDate) return fields.startDate
  if (fields.recurrence) return fields.recurrenceStart ?? firstOccurrence(fields.recurrence, ctx.today)
  if (fields.startTime) {
    const nowMin = ctx.now.getHours() * 60 + ctx.now.getMinutes()
    return minutesOfDay(fields.startTime) < nowMin ? addDays(ctx.today, 1) : ctx.today
  }
  return null
}

export function parseQuickAdd(input: string, ctx: ParseContext): ParsedQuickAdd {
  const state = runAll(input, ctx)
  const f = state.fields
  const tokens = [...state.tokens].sort((a, b) => a.start - b.start)
  return {
    title: buildTitle(input, tokens),
    startDate: fillStartDate(f, ctx),
    startTime: f.startTime,
    dayPart: f.dayPart,
    dueDate: f.dueDate,
    durationMin: f.durationMin,
    estimateMin: f.estimateMin,
    priority: f.priority,
    projectId: f.projectId,
    sectionId: f.sectionId,
    labelIds: f.labelIds,
    newLabelNames: f.newLabelNames,
    recurrence: f.recurrence,
    reminderOffsetsMin: f.reminderOffsetsMin,
    tokens,
  }
}
