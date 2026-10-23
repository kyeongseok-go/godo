// 하루 안 구간 단어(아침·점심·저녁·밤·오전·오후)와 인식기.
import type { DayPart } from '../types'
import type { Marker } from './timeAtoms'
import { allMatches, BEFORE_WORD, overlaps, type Span } from './scan'
import { token, type Recognizer } from './state'

const DAY_PART_OF: Readonly<Record<string, DayPart>> = {
  오전: 'morning',
  아침: 'morning',
  오후: 'afternoon',
  점심: 'afternoon',
  저녁: 'evening',
  밤: 'evening',
}

const LABEL_OF: Readonly<Record<DayPart, string>> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
}

const WORD = new RegExp(
  `${BEFORE_WORD}(오전|오후|아침|점심|저녁|밤)(?:에는|에|은|는|도)?(?![\\p{L}\\p{N}])`,
  'gu',
)

export interface DayPartWord extends Span {
  part: DayPart
  word: Marker
}

export function findDayPartWords(text: string): DayPartWord[] {
  return allMatches(WORD, text).map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    part: DAY_PART_OF[m[1]] ?? 'morning',
    word: m[1] as Marker,
  }))
}

/** 시각이 없을 때만 하루 구간으로 읽는다. 시각이 있으면 단어는 제목에 남는다. */
export const recognizeDayPart: Recognizer = (text, state) => {
  if (state.fields.dayPart || state.fields.startTime) return []
  const word = findDayPartWords(text).find((w) => !overlaps(state.claimed, w.start, w.end))
  if (!word) return []
  return [
    { token: token('dayPart', text, word.start, word.end, LABEL_OF[word.part]), patch: { dayPart: word.part } },
  ]
}
