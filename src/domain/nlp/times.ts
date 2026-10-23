// 시각 인식기: "오후 3시", "15:00", "3pm", 범위("3시부터 4시")와 앞의 영어 "at".
import { timeFromMinutes } from '../date'
import { formatMinutes } from './duration'
import { findDayPartWords } from './dayPart'
import { overlaps, type Span } from './scan'
import { token, type Hit, type Recognizer } from './state'
import { atomAt, resolveAtom, resolveRangeEnd, type Marker, type RawAtom } from './timeAtoms'

const BEFORE_OK = /[\s(["'“‘,;{]/
const AT_PREFIX = /at\s+/iy
const SUFFIX = /(?:에는|에|쯤에|쯤|경에|경|부터|도|은|는)?/uy
const RANGE_SUFFIX = /(?:까지|에|쯤에?|경에?)?/uy
const SEPARATOR = /\s*(?:부터|~|-|–|—|(?:to|until|till)(?![A-Za-z]))\s*/iuy
const SHARED_MERIDIEM = /(\d{1,2})(\s*[-–~]\s*)(\d{1,2})\s*(am|pm)(?![A-Za-z0-9])/iy
const NOT_WORD_AFTER = /(?![\p{L}\p{N}])/uy
const MINUTES_PER_DAY = 1440
const HALF_DAY = MINUTES_PER_DAY / 2

function sticky(re: RegExp, text: string, pos: number): RegExpExecArray | null {
  const copy = new RegExp(re.source, re.flags)
  copy.lastIndex = pos
  return copy.exec(text)
}

/** 조사(suffix) 뒤에서 단어가 끝나는지 확인하고, 끝나면 조사까지 포함한 끝 위치를 돌려준다. */
function endWithSuffix(text: string, from: number, suffix: RegExp): number | null {
  const s = sticky(suffix, text, from)
  const end = from + (s ? s[0].length : 0)
  return sticky(NOT_WORD_AFTER, text, end) ? end : null
}

/** 시각 꼴이지만 값이 불가능한 구간(25시 등). 그 안쪽을 다시 훑어 엉뚱한 시각을 만들지 않도록 건너뛴다. */
interface Skip {
  skipTo: number
}

interface TimeMatch {
  start: number
  timeEnd: number
  startMin: number
  range: { sepStart: number; end: number; durationMin: number } | null
}

/** 오전/오후 표시가 없는 "7시"를 풀 때 쓰는 단서: 시각 밖에서 가장 가까운 저녁·밤·오후 단어. 아침·점심은 기본 규칙과 같아서 쓰지 않는다. */
const HINT_WORDS: readonly Marker[] = ['저녁', '밤', '오후']

function hintFor(text: string, atomStart: number, atomEnd: number): Marker | null {
  const distance = (w: Span): number => (w.end <= atomStart ? atomStart - w.end : w.start - atomEnd)
  const outside = findDayPartWords(text).filter(
    (w) => (w.end <= atomStart || w.start >= atomEnd) && HINT_WORDS.includes(w.word),
  )
  if (outside.length === 0) return null
  return outside.reduce((best, w) => (distance(w) < distance(best) ? w : best)).word
}

function sharedMeridiemRange(text: string, pos: number): TimeMatch | null {
  const m = sticky(SHARED_MERIDIEM, text, pos)
  if (!m) return null
  const mer = m[4].toLowerCase() as 'am' | 'pm'
  const a = resolveAtom({ end: 0, hour: Number(m[1]), minute: 0, marker: null, meridiem: mer, style: 'en' }, null)
  const b = resolveAtom({ end: 0, hour: Number(m[3]), minute: 0, marker: null, meridiem: mer, style: 'en' }, null)
  if (a === null || b === null) return null
  // 끝이 시작보다 이르면 시작은 반대쪽 반나절이다: "11-1pm"은 오전 11시, "11-1am"은 밤 11시 시작
  const startMin = b < a ? (a >= HALF_DAY ? a - HALF_DAY : a + HALF_DAY) : a
  const durationMin = (b - startMin + MINUTES_PER_DAY) % MINUTES_PER_DAY
  if (durationMin === 0) return null
  const timeEnd = pos + m[1].length
  return { start: pos, timeEnd, startMin, range: { sepStart: timeEnd, end: pos + m[0].length, durationMin } }
}

function rangeAfter(text: string, atom: RawAtom, startMin: number, hint: Marker | null): TimeMatch['range'] {
  const sep = sticky(SEPARATOR, text, atom.end)
  if (!sep) return null
  const second = atomAt(text, atom.end + sep[0].length)
  if (!second) return null
  const endMin = resolveRangeEnd(second, startMin, hint)
  const end = endMin === null ? null : endWithSuffix(text, second.end, RANGE_SUFFIX)
  if (endMin === null || end === null) return null
  return { sepStart: atom.end, end, durationMin: (endMin - startMin + MINUTES_PER_DAY) % MINUTES_PER_DAY }
}

function singleAt(text: string, pos: number, tokenStart: number): TimeMatch | Skip | null {
  const atom = atomAt(text, pos)
  if (!atom) return null
  const hint = hintFor(text, pos, atom.end)
  const startMin = resolveAtom(atom, hint)
  if (startMin === null) return { skipTo: atom.end }
  const range = rangeAfter(text, atom, startMin, hint)
  if (range) return { start: tokenStart, timeEnd: atom.end, startMin, range }
  const end = endWithSuffix(text, atom.end, SUFFIX)
  return end === null ? null : { start: tokenStart, timeEnd: end, startMin, range: null }
}

function matchAt(text: string, i: number): TimeMatch | Skip | null {
  if (i > 0 && !BEFORE_OK.test(text[i - 1])) return null
  const shared = sharedMeridiemRange(text, i)
  if (shared) return shared
  const direct = singleAt(text, i, i)
  if (direct) return direct
  const at = sticky(AT_PREFIX, text, i)
  return at ? singleAt(text, i + at[0].length, i) : null
}

function toHits(text: string, m: TimeMatch): Hit[] {
  const time: Hit = {
    token: token('time', text, m.start, m.timeEnd, timeFromMinutes(m.startMin)),
    patch: { startTime: timeFromMinutes(m.startMin) },
  }
  if (!m.range) return [time]
  const duration: Hit = {
    token: token('duration', text, m.range.sepStart, m.range.end, formatMinutes(m.range.durationMin)),
    patch: { durationMin: m.range.durationMin },
  }
  return [time, duration]
}

function firstFree(text: string, claimed: readonly Span[]): TimeMatch | null {
  for (let i = 0; i < text.length; i += 1) {
    const m = matchAt(text, i)
    if (!m) continue
    if ('skipTo' in m) {
      i = m.skipTo - 1
    } else if (!overlaps(claimed, m.start, m.range?.end ?? m.timeEnd)) {
      return m
    }
  }
  return null
}

export const recognizeTime: Recognizer = (text, state) => {
  if (state.fields.startTime) return []
  const found = firstFree(text, state.claimed)
  return found ? toHits(text, found) : []
}
