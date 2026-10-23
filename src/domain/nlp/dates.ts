// 시작일 인식기: 입력에서 가장 먼저 나오는 날짜 구절 하나만 쓴다.
import { findDateCandidates } from './dateCandidates'
import { describeDate } from './labels'
import { overlaps } from './scan'
import { token, type Recognizer } from './state'

export const recognizeDate: Recognizer = (text, state, ctx) => {
  if (state.fields.startDate) return []
  const found = findDateCandidates(text, ctx).find((c) => !overlaps(state.claimed, c.start, c.end))
  if (!found) return []
  return [
    {
      token: token('date', text, found.start, found.end, describeDate(found.date, ctx.today)),
      patch: { startDate: found.date },
    },
  ]
}
