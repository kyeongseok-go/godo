// 조건 하나(원자)를 읽는다: 키워드, 날짜 구간, #프로젝트, /섹션, @라벨, 비교 조건, 검색.
import { parseDateExpr } from './dateExpr'
import type { CompareField, CompareOp, FilterNode, NamePattern } from './ast'
import {
  Cursor,
  ParseFailure,
  peek,
  peekWords,
  readSegments,
  readValueText,
  skipWhitespace,
} from './cursor'
import type { Word } from './cursor'
import {
  COMPARE_KEYWORDS,
  normalizeKeyword,
  PLAIN_KEYWORDS,
  VALUED_KEYWORDS,
} from './keywords'
import type { ValuedSpec } from './keywords'
import { parseCount, parseDurationMin } from './values'

const MAX_WINDOW_DAYS = 36_500
const MAX_KEYWORD_WORDS = 3
const PRIORITY_WORD = /^p([1-4])$/
const WINDOW_WORD = /^(-?)(\d+)(days?|일)?$/
const WINDOW_UNIT = /^(days?|일)$/

export function parseAtom(cursor: Cursor): FilterNode {
  const node = readAtom(cursor)
  cursor.last = node
  return node
}

function readAtom(cursor: Cursor): FilterNode {
  switch (peek(cursor)) {
    case '#':
      return parseProject(cursor)
    case '/':
      return { type: 'section', name: readName(cursor, 1, '섹션') }
    case '@':
    case '%':
      return { type: 'label', name: readName(cursor, 1, '라벨') }
    case '"':
      return rejectBareQuote(cursor)
    default:
      return parseKeywordAtom(cursor)
  }
}

function parseProject(cursor: Cursor): FilterNode {
  const includeChildren = cursor.src[cursor.pos + 1] === '#'
  return { type: 'project', name: readName(cursor, includeChildren ? 2 : 1, '프로젝트'), includeChildren }
}

function readName(cursor: Cursor, prefixLength: number, what: string): NamePattern {
  cursor.pos += prefixLength
  const start = cursor.pos
  const segments = readSegments(cursor, peek(cursor) === '"', true)
  if (segments.length === 1 && segments[0] === '') {
    throw new ParseFailure(`${what} 이름이 필요합니다`, start)
  }
  return segments
}

/** 따옴표 문자열은 search: 값으로만 쓴다. 맨 문자열은 검색으로 취급하지 않는다. */
function rejectBareQuote(cursor: Cursor): never {
  const start = cursor.pos
  const text = readSegments(cursor, true, false).join('')
  throw new ParseFailure(unknownMessage(text), start)
}

const unknownMessage = (text: string): string => `알 수 없는 조건 "${text}"입니다`

function parseKeywordAtom(cursor: Cursor): FilterNode {
  const words = peekWords(cursor, MAX_KEYWORD_WORDS)
  if (words.length === 0) {
    throw new ParseFailure(unknownMessage(peek(cursor)), cursor.pos)
  }
  const valued = matchValued(words)
  if (valued) {
    cursor.pos = valued.colonPos + 1
    return parseValued(cursor, valued.spec, valued.label)
  }
  const window = matchDayWindow(words)
  if (window) {
    cursor.pos = words[window.consumed - 1].end
    return window.node
  }
  const first = words[0]
  const field = COMPARE_KEYWORDS.get(normalizeKeyword(first.text))
  if (field) {
    cursor.pos = first.end
    return parseCompare(cursor, field, first.text)
  }
  const plain = matchPlain(words)
  if (plain) {
    cursor.pos = words[plain.consumed - 1].end
    return plain.node
  }
  throw unknownKeyword(words)
}

function unknownKeyword(words: readonly Word[]): ParseFailure {
  const first = words[0]
  for (let count = Math.min(2, words.length); count >= 1; count -= 1) {
    const label = words.slice(0, count).map((w) => w.text).join(' ')
    if (VALUED_KEYWORDS.has(normalizeKeyword(label))) {
      return new ParseFailure(`"${label}" 뒤에 ":"와 값이 필요합니다`, first.start)
    }
  }
  return new ParseFailure(unknownMessage(first.text), first.start)
}

interface ValuedMatch {
  spec: ValuedSpec
  colonPos: number
  label: string
}

/** 마지막 단어 뒤에 ':' 가 있는 `date`, `date before` 같은 머리말 */
function matchValued(words: readonly Word[]): ValuedMatch | null {
  const last = words[words.length - 1]
  if (last.colonPos < 0) return null
  const label = words.map((w) => w.text).join(' ')
  const spec = VALUED_KEYWORDS.get(normalizeKeyword(label))
  return spec ? { spec, colonPos: last.colonPos, label } : null
}

interface Matched {
  node: FilterNode
  consumed: number
}

/** `p1`, `no date`, `view all` 처럼 값 없는 키워드. 긴 것부터 맞춘다. */
function matchPlain(words: readonly Word[]): Matched | null {
  const priority = PRIORITY_WORD.exec(words[0].text.toLowerCase())
  if (priority) {
    const level = Number(priority[1]) as 1 | 2 | 3 | 4
    return { node: { type: 'priority', level }, consumed: 1 }
  }
  for (let count = words.length; count >= 1; count -= 1) {
    const key = normalizeKeyword(words.slice(0, count).map((w) => w.text).join(''))
    const make = PLAIN_KEYWORDS.get(key)
    if (make) return { node: make(), consumed: count }
  }
  return null
}

/** `7 days` `7일` `next 7 days` `다음 7일` `-3 days` */
function matchDayWindow(words: readonly Word[]): Matched | null {
  const lead = words[0].text.toLowerCase()
  const skip = lead === 'next' || lead === '다음' ? 1 : 0
  const numberWord = words[skip]
  if (!numberWord) return null
  const match = WINDOW_WORD.exec(numberWord.text.toLowerCase())
  if (!match || (skip === 1 && match[1] === '-')) return null
  let consumed = skip + 1
  if (!match[3]) {
    const unit = words[consumed]
    if (!unit || !WINDOW_UNIT.test(unit.text.toLowerCase())) return null
    consumed += 1
  }
  const days = Number(match[2])
  if (days < 1) throw new ParseFailure('일수는 1 이상이어야 합니다', numberWord.start)
  if (days > MAX_WINDOW_DAYS) throw new ParseFailure('일수가 너무 큽니다', numberWord.start)
  const direction = match[1] === '-' ? 'past' : 'next'
  return { node: { type: 'dateWindow', direction, days }, consumed }
}

function parseValued(cursor: Cursor, spec: ValuedSpec, label: string): FilterNode {
  if (spec.kind === 'search') return parseSearch(cursor)
  const { text, start } = readValueText(cursor)
  if (text === '') throw new ParseFailure(`"${label}:" 뒤에 날짜가 필요합니다`, start)
  const parsed = parseDateExpr(text)
  if (!parsed.ok) throw new ParseFailure(parsed.message, start)
  return { type: 'date', field: spec.field, op: spec.op, value: parsed.expr }
}

function parseSearch(cursor: Cursor): FilterNode {
  skipWhitespace(cursor)
  const start = cursor.pos
  const text = readSegments(cursor, peek(cursor) === '"', false).join('')
  if (text === '') throw new ParseFailure('검색어가 필요합니다', start)
  return { type: 'search', text, needle: text.toLowerCase() }
}

function readComparator(cursor: Cursor): CompareOp | null {
  const ch = peek(cursor)
  if (ch !== '<' && ch !== '>' && ch !== '=') return null
  cursor.pos += 1
  if (peek(cursor) === '=') {
    cursor.pos += 1
    return ch === '=' ? '=' : (`${ch}=` as CompareOp)
  }
  return ch
}

function parseCompare(cursor: Cursor, field: CompareField, label: string): FilterNode {
  skipWhitespace(cursor)
  const op = readComparator(cursor)
  if (!op) {
    if (field === 'postponed') return { type: 'compare', field, op: '>=', value: 1 }
    throw new ParseFailure(`"${label}" 뒤에 비교 연산자와 값이 필요합니다 (예: ${label} > 30m)`, cursor.pos)
  }
  const { text, start } = readValueText(cursor)
  const noun = field === 'postponed' ? '횟수' : '시간'
  if (text === '') throw new ParseFailure(`비교할 ${noun} 값이 필요합니다`, start)
  const value = field === 'postponed' ? parseCount(text) : parseDurationMin(text)
  if (value === null) {
    const hint = field === 'postponed' ? '0 이상의 정수' : '예: 30m, 1h30m, 45분'
    throw new ParseFailure(`"${text}"은(는) 올바른 ${noun}이 아닙니다 (${hint})`, start)
  }
  return { type: 'compare', field, op, value }
}
