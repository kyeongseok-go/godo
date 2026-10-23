// 인식된 구간을 지우고 남은 글자로 제목을 만든다.
import type { Span } from './scan'

const REMOVED = '\uE000' // 사용자 입력에 나올 일이 없는 사설 영역 문자
const EMPTY_BRACKETS = new RegExp(`[(\\[{]\\s*${REMOVED}[\\s${REMOVED}]*[)\\]}]`, 'g')

/** spans는 서로 겹치지 않는다고 가정한다. 지운 자리는 공백 하나로 잇고, 빈 괄호와 남은 구분 기호를 정리한다. */
export function buildTitle(input: string, spans: readonly Span[]): string {
  if (spans.length === 0) return input.replace(/\s+/g, ' ').trim()
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const s of sorted) {
    out += input.slice(cursor, s.start) + REMOVED
    cursor = s.end
  }
  out += input.slice(cursor)
  return out
    .replace(EMPTY_BRACKETS, '')
    .replaceAll(REMOVED, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:])/g, '$1')
    .replace(/^[\s,;:]+|[\s,;:]+$/g, '')
}
