// 라우트 경로를 한 곳에서 만든다. 문자열 경로를 화면 코드에 흩뿌리지 않으려는 것이다.
import type { ID } from '../domain/types'
import type { ProjectView } from '../domain/types'

export const paths = {
  today: '/today',
  upcoming: '/upcoming',
  inbox: '/inbox',
  now: '/now',
  all: '/all',
  someday: '/someday',
  completed: '/completed',
  canceled: '/canceled',
  trash: '/trash',
  calendar: '/calendar',
  matrix: '/matrix',
  timeline: '/timeline',
  habits: '/habits',
  focus: '/focus',
  countdown: '/countdown',
  productivity: '/productivity',
  summary: '/summary',
  review: '/review',
  replan: '/replan',
  plan: '/plan',
  help: '/help',
  search: (q = '') => (q ? `/search?q=${encodeURIComponent(q)}` : '/search'),
  project: (id: ID, view?: ProjectView) => (view ? `/project/${id}?view=${view}` : `/project/${id}`),
  label: (id: ID) => `/label/${id}`,
  filter: (id: ID) => `/filter/${id}`,
  settings: (tab = 'general') => `/settings/${tab}`,
} as const

/** 홈 화면 설정값(settings.homeView)을 경로로 바꾼다 */
export function homePath(homeView: string): string {
  if (homeView.startsWith('project:')) return paths.project(homeView.slice('project:'.length))
  const known = ['today', 'upcoming', 'inbox', 'now', 'all', 'calendar', 'matrix'] as const
  return (known as readonly string[]).includes(homeView) ? `/${homeView}` : paths.today
}
