// 입력창 자동완성용 키워드 후보. 프로젝트·라벨 이름은 컨텍스트가 필요해서 여기서는 다루지 않는다.
import { normalizeKeyword, VALUED_KEYWORDS } from './keywords'

const MAX_SUGGESTIONS = 8

const KEYWORDS: readonly string[] = [
  'today', 'tomorrow', 'yesterday', 'overdue',
  'no date', 'no time', 'no deadline', 'no labels', 'no priority',
  '7 days', 'next 7 days',
  'date:', 'date before:', 'date after:',
  'deadline:', 'deadline before:', 'deadline after:',
  'created:', 'created before:', 'created after:',
  'p1', 'p2', 'p3', 'p4',
  'recurring', 'subtask', 'blocked', 'hold', 'someday', 'pinned',
  'postponed', 'estimate', 'completed', 'canceled', 'view all', 'all', 'search:',
  '오늘', '내일', '어제', '기한초과',
  '날짜없음', '시간없음', '마감없음', '라벨없음',
  '날짜:', '날짜이전:', '날짜이후:', '마감:', '마감이전:', '마감이후:', '생성:', '검색:',
  '반복', '하위작업', '막힘', '보류', '언젠가', '고정', '미룸', '예상', '완료', '취소', '전체보기', '전체',
]

const DATE_VALUES: readonly string[] = [
  'today', 'tomorrow', 'yesterday', 'next week',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  '오늘', '내일', '모레', '어제', '다음주',
]

const SEGMENT_BREAKS = new Set(['(', ')', '&', '|', ',', '!'])
const NAME_PREFIXES = new Set(['#', '%', '@', '/'])

/** 입력 끝의 미완성 단어를 완성할 키워드 후보(최대 8개). 후보가 없으면 빈 배열. */
export function suggestCompletions(partial: string): string[] {
  const segment = lastSegment(partial)
  const colon = segment.lastIndexOf(':')
  if (colon >= 0) {
    const spec = VALUED_KEYWORDS.get(normalizeKeyword(segment.slice(0, colon)))
    if (spec?.kind !== 'date') return []
    return complete(segment.slice(colon + 1), DATE_VALUES)
  }
  return complete(segment, KEYWORDS)
}

/** 마지막 연산자·괄호 뒤에서 시작하는 조각 */
function lastSegment(text: string): string {
  let start = 0
  for (let i = text.length - 1; i >= 0; i -= 1) {
    if (SEGMENT_BREAKS.has(text[i])) {
      start = i + 1
      break
    }
  }
  return text.slice(start)
}

function complete(fragment: string, candidates: readonly string[]): string[] {
  const prefix = fragment.trimStart().toLowerCase()
  if (prefix === '' || NAME_PREFIXES.has(prefix[0])) return []
  const matches = candidates.filter((c) => c.startsWith(prefix) && c !== prefix)
  return [...new Set(matches)].slice(0, MAX_SUGGESTIONS)
}
