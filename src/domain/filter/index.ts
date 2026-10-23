// 필터 쿼리 언어(Todoist 스타일)의 공개 API.
//
// 날짜 의미(우리 모델에 맞춰 고정)
// - Todoist의 "due date" = 우리의 startDate(할 날), Todoist의 "deadline" = 우리의 dueDate(마감).
// - today/tomorrow/overdue/date:/no date/N days 의 기준은 effective = startDate ?? dueDate.
// - deadline: / 마감: / no deadline 만 dueDate 를 본다.
// - `due:` `due before:` `due after:` 는 Todoist와 달리 deadline 쪽으로 해석한다.
// - 연도를 생략한 날짜(Oct 30, 10월 30일, 10/30)는 "오늘"이 속한 해로 푼다.
// - `N days` = 오늘부터 N일(오늘 포함, 오늘+N-1까지), 지난 날짜(overdue)는 포함하지 않는다.
//   `-N days` = 오늘까지 N일(오늘 포함, 오늘-(N-1)부터). 둘 다 effective 날짜 기준이다.
//
// 결과에 들어가는 작업
// - 삭제된 작업(deletedAt)은 항상 제외한다.
// - 완료·취소 작업은 기본 제외. 묶음 안에 부정되지 않은 `view all`/`전체보기` 가 있으면 둘 다,
//   `completed`/`완료` 면 완료만, `canceled`/`취소` 면 취소만 그 묶음에 한해 포함한다.
//
// 지원하지 않는 것: 시각이 붙은 날짜(`today at 2pm`), 쉼표가 들어간 날짜(`Oct 30, 2026`),
// 괄호 안 쉼표, 담당자 조건(assigned to:), 맨 단어 검색(알 수 없는 조건 오류).
export type { FilterError, FilterNode, ParseResult } from './ast'
export { describeFilter } from './describe'
export { matchesFilter, runFilter } from './engine'
export type { RunFilterResult } from './engine'
export { parseFilter } from './parser'
export { suggestCompletions } from './suggest'
