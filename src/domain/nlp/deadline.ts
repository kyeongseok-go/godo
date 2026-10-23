// 마감일 인식기: {내일}, 마감 금요일, 금요일까지, due friday.
import { findDateCandidates, type DateCandidate } from './dateCandidates'
import { describeDate } from './labels'
import { allMatches, group, overlaps } from './scan'
import { token, type Hit, type Recognizer } from './state'
import type { ParseContext } from './types'

const BRACES = /(?<!\S)\{([^{}]*)\}/g
const KEYWORD_KO = /(?<![^\s([{"'“‘,;])(?:마감일?|마감\s*기한|기한)\s*[:：]?\s*/gu
const KEYWORD_EN = /(?<![^\s([{"'“‘,;])(?:due|by)\s+/giu
const UNTIL = /^\s*까지(?![\p{L}\p{N}])/u

function deadlineHit(text: string, start: number, end: number, date: string, ctx: ParseContext): Hit {
  return {
    token: token('deadline', text, start, end, `마감 · ${describeDate(date, ctx.today)}`),
    patch: { dueDate: date },
  }
}

/** 중괄호 안이 날짜 구절 하나로 딱 떨어질 때만 마감일이다. */
function bracedDeadlines(text: string, ctx: ParseContext): Hit[] {
  const hits: Hit[] = []
  for (const m of allMatches(BRACES, text)) {
    const inner = group(m, 1) ?? ''
    const lead = inner.length - inner.trimStart().length
    const trimmedEnd = inner.trimEnd().length
    const whole = findDateCandidates(inner, ctx).find((c) => c.start === lead && c.end === trimmedEnd)
    if (whole) hits.push(deadlineHit(text, m.index, m.index + m[0].length, whole.date, ctx))
  }
  return hits
}

function keywordDeadlines(text: string, ctx: ParseContext, free: readonly DateCandidate[]): Hit[] {
  const hits: Hit[] = []
  for (const re of [KEYWORD_KO, KEYWORD_EN]) {
    for (const m of allMatches(re, text)) {
      const after = m.index + m[0].length
      const cand = free.find((c) => c.start === after)
      if (cand) hits.push(deadlineHit(text, m.index, cand.end, cand.date, ctx))
    }
  }
  return hits
}

function untilDeadlines(text: string, ctx: ParseContext, free: readonly DateCandidate[]): Hit[] {
  const hits: Hit[] = []
  for (const cand of free) {
    const tail = UNTIL.exec(text.slice(cand.end))
    if (tail) hits.push(deadlineHit(text, cand.start, cand.end + tail[0].length, cand.date, ctx))
  }
  return hits
}

/** { } 마감은 기호라서 parseDates가 꺼져도 읽는다. */
export const recognizeBracedDeadline: Recognizer = (text, state, ctx) => {
  if (state.fields.dueDate) return []
  const first = bracedDeadlines(text, ctx).find((h) => !overlaps(state.claimed, h.token.start, h.token.end))
  return first ? [first] : []
}

export const recognizeWordDeadline: Recognizer = (text, state, ctx) => {
  if (state.fields.dueDate) return []
  const free = findDateCandidates(text, ctx).filter((c) => !overlaps(state.claimed, c.start, c.end))
  const hits = [...keywordDeadlines(text, ctx, free), ...untilDeadlines(text, ctx, free)]
    .filter((h) => !overlaps(state.claimed, h.token.start, h.token.end))
    .sort((a, b) => a.token.start - b.token.start)
  return hits.length > 0 ? [hits[0]] : []
}
