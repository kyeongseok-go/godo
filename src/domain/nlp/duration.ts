// "1시간 30분", "1h30m", "1.5h" 같은 기간 표현을 분으로 바꾼다. 예상 시간(~)과 알림(!)이 함께 쓴다.
export interface DurationMatch {
  minutes: number
  end: number
}

const DAYS = /(\d+(?:\.\d+)?)\s*(?:days?|d|일)(?![A-Za-z])/iy
const HOURS = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h|시간)(?![A-Za-z])/iy
const HALF = /\s*반(?![\p{L}])/uy
const MINUTES = /\s*(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m|분)(?![A-Za-z])/iy

function stickyAt(re: RegExp, text: string, pos: number): RegExpExecArray | null {
  const copy = new RegExp(re.source, re.flags)
  copy.lastIndex = pos
  return copy.exec(text)
}

/**
 * pos에서 시작하는 기간을 읽는다. 일 → 시간 → 분 순서이고 각 부분은 생략할 수 있지만 하나는 있어야 한다.
 * 일 단위는 알림(!1일)처럼 allowDays일 때만 읽는다.
 */
export function parseDurationAt(text: string, pos: number, allowDays: boolean): DurationMatch | null {
  if (pos >= text.length || /\s/.test(text[pos])) return null
  let cursor = pos
  let minutes = 0
  let found = false

  const days = allowDays ? stickyAt(DAYS, text, cursor) : null
  if (days) {
    minutes += parseFloat(days[1]) * 1440
    cursor += days[0].length
    found = true
    cursor += text.slice(cursor).match(/^\s*/)?.[0].length ?? 0
  }

  const hours = stickyAt(HOURS, text, cursor)
  if (hours) {
    minutes += parseFloat(hours[1]) * 60
    cursor += hours[0].length
    found = true
    const half = stickyAt(HALF, text, cursor)
    if (half) {
      minutes += 30
      cursor += half[0].length
    }
  }

  const mins = stickyAt(MINUTES, text, cursor)
  if (mins) {
    minutes += parseFloat(mins[1])
    cursor += mins[0].length
    found = true
  }

  return found ? { minutes: Math.round(minutes), end: cursor } : null
}

/** 칩에 보일 한국어 길이 표기: 90 → "1시간 30분" */
export function formatMinutes(total: number): string {
  if (total >= 1440 && total % 1440 === 0) return `${total / 1440}일`
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}
