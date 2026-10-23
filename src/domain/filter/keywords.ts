// 키워드 표. 키는 소문자·공백 제거 형태라서 "no date" "no  date" "nodate" 가 모두 같은 키가 된다.
import type { CompareField, DateField, DateOp, FilterNode, FlagName } from './ast'

export const normalizeKeyword = (text: string): string => text.toLowerCase().replace(/\s+/g, '')

const flag = (name: FlagName): (() => FilterNode) => () => ({ type: 'flag', flag: name })
const dateOnOffset = (days: number): (() => FilterNode) => () => ({
  type: 'date',
  field: 'date',
  op: 'on',
  value: { kind: 'offset', days },
})
const simple = (type: 'overdue' | 'noDate' | 'noTime' | 'noDeadline' | 'noLabels'): (() => FilterNode) =>
  () => ({ type })

/** 값이 없는 키워드 → 노드 생성기 */
export const PLAIN_KEYWORDS: ReadonlyMap<string, () => FilterNode> = new Map([
  ['today', dateOnOffset(0)],
  ['오늘', dateOnOffset(0)],
  ['tomorrow', dateOnOffset(1)],
  ['내일', dateOnOffset(1)],
  ['yesterday', dateOnOffset(-1)],
  ['어제', dateOnOffset(-1)],
  ['overdue', simple('overdue')],
  ['od', simple('overdue')],
  ['기한초과', simple('overdue')],
  ['nodate', simple('noDate')],
  ['날짜없음', simple('noDate')],
  ['notime', simple('noTime')],
  ['시간없음', simple('noTime')],
  ['nodeadline', simple('noDeadline')],
  ['마감없음', simple('noDeadline')],
  ['nolabels', simple('noLabels')],
  ['nolabel', simple('noLabels')],
  ['라벨없음', simple('noLabels')],
  // p4와 같은 뜻이라 우선순위 노드로 만든다.
  ['nopriority', () => ({ type: 'priority', level: 4 })],
  ['recurring', flag('recurring')],
  ['반복', flag('recurring')],
  ['subtask', flag('subtask')],
  ['하위작업', flag('subtask')],
  ['blocked', flag('blocked')],
  ['막힘', flag('blocked')],
  ['hold', flag('hold')],
  ['보류', flag('hold')],
  ['someday', flag('someday')],
  ['언젠가', flag('someday')],
  ['pinned', flag('pinned')],
  ['고정', flag('pinned')],
  ['completed', flag('completed')],
  ['완료', flag('completed')],
  ['canceled', flag('canceled')],
  ['cancelled', flag('canceled')],
  ['취소', flag('canceled')],
  ['viewall', flag('viewAll')],
  ['전체보기', flag('viewAll')],
  ['all', flag('all')],
  ['전체', flag('all')],
])

export type ValuedSpec =
  | { readonly kind: 'date'; readonly field: DateField; readonly op: DateOp }
  | { readonly kind: 'search' }

const dated = (field: DateField, op: DateOp): ValuedSpec => ({ kind: 'date', field, op })

/** `키워드: 값` 형태 */
export const VALUED_KEYWORDS: ReadonlyMap<string, ValuedSpec> = new Map([
  ['date', dated('date', 'on')],
  ['날짜', dated('date', 'on')],
  ['datebefore', dated('date', 'before')],
  ['before', dated('date', 'before')],
  ['날짜이전', dated('date', 'before')],
  ['dateafter', dated('date', 'after')],
  ['after', dated('date', 'after')],
  ['날짜이후', dated('date', 'after')],
  // Todoist의 due는 "날짜 또는 마감"이지만 우리 모델에서는 마감(dueDate)으로 해석한다.
  ['deadline', dated('deadline', 'on')],
  ['마감', dated('deadline', 'on')],
  ['due', dated('deadline', 'on')],
  ['deadlinebefore', dated('deadline', 'before')],
  ['duebefore', dated('deadline', 'before')],
  ['마감이전', dated('deadline', 'before')],
  ['deadlineafter', dated('deadline', 'after')],
  ['dueafter', dated('deadline', 'after')],
  ['마감이후', dated('deadline', 'after')],
  ['created', dated('created', 'on')],
  ['생성', dated('created', 'on')],
  ['createdbefore', dated('created', 'before')],
  ['생성이전', dated('created', 'before')],
  ['createdafter', dated('created', 'after')],
  ['생성이후', dated('created', 'after')],
  ['search', { kind: 'search' }],
  ['검색', { kind: 'search' }],
])

/** 비교 연산자를 받는 키워드 */
export const COMPARE_KEYWORDS: ReadonlyMap<string, CompareField> = new Map([
  ['postponed', 'postponed'],
  ['미룸', 'postponed'],
  ['estimate', 'estimate'],
  ['예상', 'estimate'],
])
