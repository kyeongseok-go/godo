// 필터 쿼리 AST. 판별 유니온이며 파서가 만든 뒤에는 바꾸지 않는다.
import type { ISODate, Priority, Weekday } from '../types'

/** 날짜 표현식. 오늘 날짜가 필요한 값은 파싱 때 풀지 않고 평가 때 푼다. */
export type DateExpr =
  | { readonly kind: 'iso'; readonly date: ISODate }
  /** 연도를 생략한 날짜. 평가 시점 "오늘"의 연도를 쓴다. */
  | { readonly kind: 'monthDay'; readonly month: number; readonly day: number }
  /** 오늘 기준 일수 차이. today=0, tomorrow=1, yesterday=-1 */
  | { readonly kind: 'offset'; readonly days: number }
  /** 오늘 포함, 오늘 이후 가장 가까운 해당 요일 */
  | { readonly kind: 'weekday'; readonly weekday: Weekday }
  /** 설정의 한 주 시작 요일 기준 다음 주 시작일 */
  | { readonly kind: 'nextWeek' }

/** date=할 날(effective), deadline=마감, created=생성일 */
export type DateField = 'date' | 'deadline' | 'created'
export type DateOp = 'on' | 'before' | 'after'
export type CompareOp = '<' | '<=' | '=' | '>=' | '>'
export type CompareField = 'postponed' | 'estimate'

/**
 * 와일드카드(*)로 쪼갠 리터럴 조각. 와일드카드가 없으면 조각 하나다.
 * 예: `Work*` → ['Work', ''], `*a*b` → ['', 'a', 'b'], 이스케이프한 `a\*b` → ['a*b']
 */
export type NamePattern = readonly string[]

export type FlagName =
  | 'recurring'
  | 'subtask'
  | 'blocked'
  | 'hold'
  | 'someday'
  | 'pinned'
  | 'completed'
  | 'canceled'
  | 'viewAll'
  | 'all'

export type FilterNode =
  | { readonly type: 'and'; readonly children: readonly FilterNode[] }
  | { readonly type: 'or'; readonly children: readonly FilterNode[] }
  | { readonly type: 'not'; readonly child: FilterNode }
  | {
      readonly type: 'date'
      readonly field: DateField
      readonly op: DateOp
      readonly value: DateExpr
    }
  /** `7 days`(오늘부터 N일, 오늘 포함) 또는 `-7 days`(오늘까지 N일, 오늘 포함) */
  | { readonly type: 'dateWindow'; readonly direction: 'next' | 'past'; readonly days: number }
  | { readonly type: 'overdue' }
  | { readonly type: 'noDate' }
  | { readonly type: 'noTime' }
  | { readonly type: 'noDeadline' }
  | { readonly type: 'noLabels' }
  | { readonly type: 'priority'; readonly level: Priority }
  | { readonly type: 'project'; readonly name: NamePattern; readonly includeChildren: boolean }
  | { readonly type: 'section'; readonly name: NamePattern }
  | { readonly type: 'label'; readonly name: NamePattern }
  | { readonly type: 'flag'; readonly flag: FlagName }
  | {
      readonly type: 'compare'
      readonly field: CompareField
      readonly op: CompareOp
      readonly value: number
    }
  /** needle은 text를 소문자로 바꾼 값(평가 때마다 다시 만들지 않으려는 것) */
  | { readonly type: 'search'; readonly text: string; readonly needle: string }

export type NodeOf<T extends FilterNode['type']> = Extract<FilterNode, { type: T }>

export interface FilterError {
  message: string
  position: number
}

export type ParseResult = { ok: true; ast: FilterNode[] } | { ok: false; error: FilterError }
