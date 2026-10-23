// 개발 전용: 화면 확인과 E2E 테스트를 위한 샘플 데이터. 프로덕션 빌드에는 포함되지 않는다.
import { addDays, fromISODate, todayOf } from '../domain/date'
import { presetRule } from '../domain/recurrence'
import type { Countdown, FocusSession, Habit, Label, Project, Section, Task } from '../domain/types'
import { useApp } from '../store/app'
import { buildTask } from '../store/commands/taskFactory'
import type { NewTaskInput } from '../store/commands/taskFactory'

/** 어제부터 거슬러 days 일 동안, skipEvery 번째 날만 빼고 value 를 기록한 샘플 로그 */
function patternLogs(days: number, skipEvery: number, value: number): Record<string, number> {
  const today = todayOf(new Date())
  return Object.fromEntries(
    Array.from({ length: days }, (_, i) => i + 1)
      .filter((i) => i % skipEvery !== 0 && i % 11 !== 0)
      .map((i) => [addDays(today, -i), value]),
  )
}

export async function seedDemo(): Promise<void> {
  // 앱이 저장된 데이터를 다 읽은 뒤에 넣어야 덮어써지지 않는다.
  while (!useApp.getState().ready) await new Promise((resolve) => setTimeout(resolve, 20))
  const now = Date.now()
  const today = todayOf(new Date())
  const s = useApp.getState()

  const projects: Project[] = [
    { id: 'p-work', name: '업무', color: '#2b4c7e', icon: null, parentId: null, isFolder: false, archived: false, favorite: true, defaultView: 'list', order: 1000, createdAt: now, deletedAt: null },
    { id: 'p-home', name: '집', color: '#2f6f5e', icon: null, parentId: null, isFolder: false, archived: false, favorite: false, defaultView: 'board', order: 2000, createdAt: now, deletedAt: null },
    { id: 'p-side', name: '사이드 프로젝트', color: '#7a3e8e', icon: null, parentId: null, isFolder: false, archived: false, favorite: false, defaultView: 'list', order: 3000, createdAt: now, deletedAt: null },
  ]
  const sections: Section[] = [
    { id: 's-todo', projectId: 'p-home', name: '할 일', order: 1000, category: 'todo' },
    { id: 's-doing', projectId: 'p-home', name: '진행 중', order: 2000, category: 'active' },
    { id: 's-done', projectId: 'p-home', name: '완료', order: 3000, category: 'done' },
    { id: 's-plan', projectId: 'p-work', name: '기획', order: 1000, category: null },
  ]
  const labels: Label[] = [
    { id: 'l-focus', name: '집중필요', color: '#d9421c', order: 1000 },
    { id: 'l-quick', name: '5분컷', color: '#2f6f5e', order: 2000 },
  ]

  const t = (input: NewTaskInput, id: string): Task => buildTask(input, now, id)
  const tasks: Task[] = [
    t({ title: '분기 보고서 초안 작성', projectId: 'p-work', sectionId: 's-plan', priority: 1, startDate: today, startTime: '10:00', durationMin: 90, estimateMin: 90, labelIds: ['l-focus'], order: 1000 }, 'a'),
    t({ title: '팀 주간 회의', projectId: 'p-work', priority: 2, startDate: today, startTime: '14:00', durationMin: 60, recurrence: presetRule('weekly', today), order: 2000 }, 'b'),
    t({ title: '디자인 시안 피드백 정리', projectId: 'p-work', priority: 2, startDate: addDays(today, 1), dueDate: addDays(today, 3), estimateMin: 45, order: 3000 }, 'c'),
    t({ title: '자료 조사', projectId: 'p-work', parentId: 'a', sectionId: 's-plan', startDate: today, order: 1000 }, 'a1'),
    t({ title: '개요 잡기', projectId: 'p-work', parentId: 'a', sectionId: 's-plan', startDate: today, order: 2000, status: 'done', completedAt: now }, 'a2'),
    t({ title: '우유 사기', projectId: 'p-home', sectionId: 's-todo', labelIds: ['l-quick'], startDate: today, dayPart: 'evening', order: 1000 }, 'd'),
    t({ title: '욕실 청소', projectId: 'p-home', sectionId: 's-doing', priority: 3, order: 1000 }, 'e'),
    t({ title: '택배 반품', projectId: 'p-home', sectionId: 's-done', status: 'done', completedAt: now, order: 1000 }, 'f'),
    t({ title: '지난주에 못 한 일', projectId: 'p-work', startDate: addDays(today, -3), postponeCount: 2, priority: 2, order: 4000 }, 'g'),
    t({ title: '블로그 글 구상', projectId: 'p-side', startDate: addDays(today, 5), order: 1000 }, 'h'),
    t({ title: '이사 준비 체크리스트', projectId: 'p-home', someday: true, order: 5000 }, 'i'),
    t({ title: '받은편지함 메모', order: 1000 }, 'j'),
    t({ title: '운동하기', projectId: 'p-home', priority: 3, startDate: today, startTime: '19:00', durationMin: 60, recurrence: presetRule('daily', today), order: 6000 }, 'k'),
  ]
  const habits: Habit[] = [
    { id: 'h1', name: '물 2리터 마시기', icon: null, color: '#2b4c7e', frequency: { type: 'daily' }, goal: { kind: 'count', target: 8, unit: '잔' }, startDate: addDays(today, -10), group: null, reminderTime: null, archived: false, logs: { [addDays(today, -1)]: 8, [addDays(today, -2)]: 8, [today]: 3 }, order: 1000 },
    { id: 'h2', name: '아침 스트레칭', icon: null, color: '#2f6f5e', frequency: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, goal: { kind: 'check', target: 1, unit: null }, startDate: addDays(today, -10), group: null, reminderTime: null, archived: false, logs: { [addDays(today, -1)]: 1 }, order: 2000 },
    { id: 'h3', name: '책 읽기', icon: null, color: '#7a3e8e', frequency: { type: 'daily' }, goal: { kind: 'count', target: 20, unit: '쪽' }, startDate: addDays(today, -90), group: '저녁', reminderTime: '21:30', archived: false, logs: patternLogs(84, 3, 20), order: 3000 },
    { id: 'h4', name: '일기 쓰기', icon: null, color: '#c2185b', frequency: { type: 'daily' }, goal: { kind: 'check', target: 1, unit: null }, startDate: addDays(today, -90), group: '저녁', reminderTime: null, archived: false, logs: { ...patternLogs(84, 5, 1), [today]: 1 }, order: 4000 },
    { id: 'h5', name: '러닝', icon: null, color: '#b8860b', frequency: { type: 'timesPerWeek', times: 3 }, goal: { kind: 'count', target: 5, unit: 'km' }, startDate: addDays(today, -60), group: '운동', reminderTime: null, archived: false, logs: patternLogs(56, 3, 5), order: 5000 },
    { id: 'h6', name: '영어 단어', icon: null, color: '#455a64', frequency: { type: 'daily' }, goal: { kind: 'check', target: 1, unit: null }, startDate: addDays(today, -40), group: null, reminderTime: null, archived: true, logs: patternLogs(20, 2, 1), order: 6000 },
  ]
  const countdowns: Countdown[] = [
    { id: 'c1', name: '엄마 생일', date: addDays(today, 12), color: '#c2185b', repeatYearly: true, order: 1000 },
    { id: 'c2', name: '정보처리기사 필기', date: addDays(today, 47), color: '#2b4c7e', repeatYearly: false, order: 2000 },
    { id: 'c3', name: '결혼기념일', date: addDays(today, 3), color: '#d9421c', repeatYearly: true, order: 3000 },
    { id: 'c4', name: '여름휴가', date: addDays(today, -40), color: '#2f6f5e', repeatYearly: false, order: 4000 },
    { id: 'c5', name: '입사 1주년', date: today, color: '#b8860b', repeatYearly: false, order: 5000 },
  ]

  // 최근 2주 집중 기록: [며칠 전, 포모 수, 연결한 할 일(없으면 null)]
  const focusPlan: ReadonlyArray<readonly [number, number, string | null]> = [
    [0, 3, 'a'], [1, 4, 'a'], [2, 2, 'c'], [3, 0, null], [4, 5, 'a'], [5, 1, null], [6, 3, 'e'],
    [8, 2, 'c'], [9, 4, 'a'], [10, 1, 'e'], [12, 3, null], [13, 2, 'c'],
  ]
  const focusSessions: FocusSession[] = focusPlan.flatMap(([ago, count, taskId]) =>
    Array.from({ length: count }, (_, i): FocusSession => {
      const day = new Date()
      day.setDate(day.getDate() - ago)
      day.setHours(9 + i, 0, 0, 0)
      return { id: `fs-${ago}-${i}`, taskId, kind: 'pomodoro', startedAt: day.getTime(), durationSec: 25 * 60, completed: true }
    }),
  )

  s.commit({ puts: { projects, sections, labels, tasks: [...tasks, ...extraTaskSamples(today, now)], habits, countdowns, focusSessions }, deletes: {} }, '샘플 데이터', { history: false })
}

const DAY_MS = 86_400_000
/** 날짜별 완료 건수(어제부터 거슬러). 쉬는 날(주말) 몇 개는 0 으로 둔다. */
const DONE_COUNTS = [4, 6, 5, 0, 0, 3, 5, 7, 2, 0, 0, 4, 6, 5, 3, 5, 0, 0, 2, 4, 6, 5, 4, 0, 0, 3, 5, 6]
const DONE_PROJECTS = ['p-work', 'p-work', 'p-home', 'p-work', 'p-side', 'p-home'] as const

/** 생산성 추이(최근 4주 완료 이력)와 주간 리뷰(마감 초과·자주 미룸·묵음·다음 행동 없음) 확인용 추가 샘플 */
function extraTaskSamples(today: string, now: number): Task[] {
  const base = (input: NewTaskInput, id: string): Task => buildTask(input, now, id)
  const idle = (task: Task, days: number): Task => ({ ...task, updatedAt: now - days * DAY_MS })

  const history = DONE_COUNTS.flatMap((count, index) =>
    Array.from({ length: count }, (_, n) =>
      base(
        {
          title: `완료한 일 ${index + 1}-${n + 1}`,
          projectId: DONE_PROJECTS[(index + n) % DONE_PROJECTS.length],
          priority: n % 4 === 0 ? 1 : 4,
          status: 'done',
          completedAt: fromISODate(addDays(today, -(index + 1))).getTime() + (9 + n) * 3_600_000,
        },
        `hist-${index + 1}-${n + 1}`,
      ),
    ),
  )

  const review: Task[] = [
    base({ title: '세금 신고 서류 준비', projectId: 'p-work', dueDate: addDays(today, -6), priority: 1, order: 7000 }, 'rv-overdue'),
    base({ title: '치과 예약하기', projectId: 'p-home', startDate: addDays(today, -2), postponeCount: 5, order: 7100 }, 'rv-postponed'),
    idle(base({ title: '책상 서랍 정리', projectId: 'p-home', order: 7200 }, 'rv-stale1'), 30),
    idle(base({ title: '오래된 아이디어 노트 훑어보기', projectId: 'p-side', order: 7300 }, 'rv-stale2'), 18),
    base({ title: '이사 견적 비교', projectId: 'p-home', order: 7400 }, 'rv-parent'),
    base({ title: '업체 세 곳에 연락', projectId: 'p-home', parentId: 'rv-parent', startDate: addDays(today, 6), order: 1000 }, 'rv-child1'),
    base({ title: '견적서 표로 정리', projectId: 'p-home', parentId: 'rv-parent', startDate: addDays(today, 8), order: 2000 }, 'rv-child2'),
  ]
  return [...history, ...review]
}
