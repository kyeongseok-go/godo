// 예상 시간(~)과 알림(!) 기호 인식기.
import { parseDurationAt, formatMinutes } from './duration'
import { allMatches, BEFORE_SYMBOL, overlaps } from './scan'
import { token, type Hit, type Recognizer } from './state'

const TILDE = new RegExp(`${BEFORE_SYMBOL}~`, 'g')
const BANG = new RegExp(`${BEFORE_SYMBOL}!`, 'g')

/** 기간 뒤에 영문·숫자가 바로 붙으면(예: ~1hello) 기간이 아니다. */
function endsCleanly(text: string, end: number): boolean {
  return !/[A-Za-z0-9]/.test(text[end] ?? '')
}

export const recognizeEstimate: Recognizer = (text, state) => {
  if (state.fields.estimateMin !== null) return []
  for (const m of allMatches(TILDE, text)) {
    const d = parseDurationAt(text, m.index + 1, false)
    if (!d || d.minutes <= 0 || !endsCleanly(text, d.end) || overlaps(state.claimed, m.index, d.end)) continue
    return [
      {
        token: token('estimate', text, m.index, d.end, `예상 ${formatMinutes(d.minutes)}`),
        patch: { estimateMin: d.minutes },
      },
    ]
  }
  return []
}

export const recognizeReminders: Recognizer = (text, state) => {
  const hits: Hit[] = []
  for (const m of allMatches(BANG, text)) {
    const d = parseDurationAt(text, m.index + 1, true)
    if (!d || !endsCleanly(text, d.end) || overlaps(state.claimed, m.index, d.end)) continue
    hits.push({
      token: token('reminder', text, m.index, d.end, `${formatMinutes(d.minutes)} 전 알림`),
      patch: { reminderOffsetsMin: [d.minutes] },
    })
  }
  return hits
}
