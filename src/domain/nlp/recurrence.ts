// 반복 인식기: 한국어·영어 패턴 후보 중 가장 먼저 나오는 것 하나를 쓴다. "완료 후 / 끝낸 날부터"가 앞에 붙으면 완료일 기준이다.
import { ENGLISH_PATTERNS } from './recurrenceEn'
import { KOREAN_PATTERNS } from './recurrenceKo'
import { describeRecurrence } from './recurrenceLabel'
import type { RecurrenceCandidate, RecurrencePattern } from './recurrenceRule'
import { allMatches, overlaps, type Span } from './scan'
import { token, type Recognizer } from './state'
import type { ParseContext } from './types'

const PATTERNS: readonly RecurrencePattern[] = [...KOREAN_PATTERNS, ...ENGLISH_PATTERNS]

const COMPLETION_PREFIX =
  /(?<![\p{L}\p{N}])(?:완료\s*(?:한\s*)?(?:후|뒤)|완료일\s*(?:부터|기준)?|끝낸\s*(?:날|후|뒤)\s*(?:부터)?)\s*$/u

function collect(text: string, ctx: ParseContext): RecurrenceCandidate[] {
  const found: RecurrenceCandidate[] = []
  for (const pattern of PATTERNS) {
    for (const m of allMatches(pattern.re, text)) {
      const built = pattern.build(m, ctx)
      if (built) {
        found.push({ start: m.index, end: m.index + m[0].length, rule: built.rule, startHint: built.startHint ?? null })
      }
    }
  }
  return found.sort((a, b) => a.start - b.start || b.end - a.end)
}

/** 후보 바로 앞의 "완료 후" 같은 구절을 찾아 구간을 넓힌다. */
function withCompletionPrefix(text: string, c: RecurrenceCandidate, claimed: readonly Span[]): RecurrenceCandidate {
  const prefix = COMPLETION_PREFIX.exec(text.slice(0, c.start))
  if (!prefix || overlaps(claimed, prefix.index, c.start)) return c
  return { ...c, start: prefix.index, rule: { ...c.rule, anchor: 'completion' } }
}

export const recognizeRecurrence: Recognizer = (text, state, ctx) => {
  if (state.fields.recurrence) return []
  const free = collect(text, ctx).find((c) => !overlaps(state.claimed, c.start, c.end))
  if (!free) return []
  const c = withCompletionPrefix(text, free, state.claimed)
  return [
    {
      token: token('recurrence', text, c.start, c.end, describeRecurrence(c.rule)),
      patch: { recurrence: c.rule, recurrenceStart: c.startHint },
    },
  ]
}
