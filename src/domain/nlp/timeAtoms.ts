// 시각 하나("오후 3시 30분", "15:00", "3pm")를 원문에서 읽어 분 단위 값으로 바꾸는 저수준 도구.
export type Marker = '오전' | '오후' | '아침' | '저녁' | '밤' | '새벽' | '낮' | '점심'

export interface RawAtom {
  /** 원자 본문의 끝(조사 제외) */
  end: number
  hour: number
  minute: number
  marker: Marker | null
  meridiem: 'am' | 'pm' | null
  style: 'ko' | 'clock' | 'en'
}

const MARKERS = '오전|오후|아침|저녁|밤|새벽|낮|점심'
const KO_ATOM = new RegExp(
  `(?:(${MARKERS})\\s*)?(\\d{1,2})시(?!간)(?:\\s*(\\d{1,2})분|\\s?(반)(?=$|[^\\p{L}]|에|쯤|경|부터|도))?`,
  'uy',
)
const CLOCK_ATOM = new RegExp(`(?:(${MARKERS})\\s*)?(\\d{1,2}):(\\d{2})(?![\\d:])(?:\\s*(am|pm)(?![A-Za-z0-9]))?`, 'iuy')
const EN_ATOM = /(\d{1,2})\s*(am|pm)(?![A-Za-z0-9])/iy

function exec(re: RegExp, text: string, pos: number): RegExpExecArray | null {
  const copy = new RegExp(re.source, re.flags)
  copy.lastIndex = pos
  return copy.exec(text)
}

const asMarker = (s: string | undefined): Marker | null => (s ? (s as Marker) : null)
const asMeridiem = (s: string | undefined): 'am' | 'pm' | null =>
  s ? (s.toLowerCase() as 'am' | 'pm') : null

export function atomAt(text: string, pos: number): RawAtom | null {
  const ko = exec(KO_ATOM, text, pos)
  if (ko) {
    const half = ko[4] !== undefined
    return {
      end: pos + ko[0].length,
      hour: Number(ko[2]),
      minute: half ? 30 : Number(ko[3] ?? 0),
      marker: asMarker(ko[1]),
      meridiem: null,
      style: 'ko',
    }
  }
  const clock = exec(CLOCK_ATOM, text, pos)
  if (clock) {
    return {
      end: pos + clock[0].length,
      hour: Number(clock[2]),
      minute: Number(clock[3]),
      marker: asMarker(clock[1]),
      meridiem: asMeridiem(clock[4]),
      style: 'clock',
    }
  }
  const en = exec(EN_ATOM, text, pos)
  if (en) {
    return {
      end: pos + en[0].length,
      hour: Number(en[1]),
      minute: 0,
      marker: null,
      meridiem: asMeridiem(en[2]),
      style: 'en',
    }
  }
  return null
}

function hourWithMarker(h: number, marker: Marker): number | null {
  switch (marker) {
    // 오전·새벽 12시는 관례대로 자정
    case '오전':
    case '새벽':
      return h >= 1 && h <= 12 ? h % 12 : h === 0 ? 0 : null
    // 아침 12시는 자정이 아니라 정오로 읽는다
    case '아침':
      if (h === 12) return 12
      return h >= 1 && h <= 11 ? h : h === 0 ? 0 : null
    case '오후':
      return h >= 1 && h <= 11 ? h + 12 : h === 12 ? 12 : null
    // 저녁 12시는 정오가 아니라 자정으로 읽는다
    case '저녁':
      if (h === 12) return 0
      return h >= 1 && h <= 11 ? h + 12 : null
    case '밤':
      if (h >= 1 && h <= 5) return h
      if (h >= 6 && h <= 11) return h + 12
      return h === 12 ? 0 : null
    case '낮':
      if (h === 12 || (h >= 6 && h <= 11)) return h
      return h >= 1 && h <= 5 ? h + 12 : null
    case '점심':
      if (h === 11 || h === 12) return h
      return h >= 1 && h <= 3 ? h + 12 : null
  }
}

function plainHour(h: number, hint: Marker | null): number | null {
  if (h < 0 || h > 23) return null
  if (h === 0 || h >= 12) return h
  const hinted = hint ? hourWithMarker(h, hint) : null
  if (hinted !== null) return hinted
  return h <= 6 ? h + 12 : h // 근무 시간대 관례: 1~6시는 오후, 7~11시는 오전
}

function meridiemHour(h: number, m: 'am' | 'pm'): number | null {
  if (h < 1 || h > 12) return null
  return m === 'am' ? h % 12 : (h % 12) + 12
}

/** 원자 하나를 하루 중 분(0~1439)으로. 해석할 수 없으면 null. */
export function resolveAtom(atom: RawAtom, hint: Marker | null): number | null {
  if (atom.minute > 59) return null
  let hour: number | null
  if (atom.marker) hour = hourWithMarker(atom.hour, atom.marker)
  else if (atom.meridiem) hour = meridiemHour(atom.hour, atom.meridiem)
  else if (atom.style === 'clock') hour = atom.hour <= 23 ? atom.hour : null
  else hour = plainHour(atom.hour, hint)
  return hour === null ? null : hour * 60 + atom.minute
}

/** 두 번째 시각이 오전/오후 표시 없이 "4시"처럼 올 때, 시작보다 뒤에 오는 가장 가까운 해석 */
export function resolveRangeEnd(atom: RawAtom, startMin: number, hint: Marker | null): number | null {
  const ambiguous = atom.style === 'ko' && !atom.marker && atom.hour >= 1 && atom.hour <= 11
  const candidates = ambiguous
    ? [atom.hour * 60 + atom.minute, (atom.hour + 12) * 60 + atom.minute]
    : [resolveAtom(atom, hint)]
  const valid = candidates.filter((c): c is number => c !== null && atom.minute <= 59)
  const diffs = valid.map((c) => ({ c, diff: (c - startMin + 1440) % 1440 })).filter((x) => x.diff > 0)
  if (diffs.length === 0) return null
  return diffs.reduce((best, x) => (x.diff < best.diff ? x : best)).c
}
