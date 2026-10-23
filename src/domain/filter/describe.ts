// 필터 쿼리를 사람이 읽는 한국어로 풀어 쓴다. 저장된 필터 목록의 설명 문구에 쓴다.
import { WEEKDAY_KO } from '../date'
import type { CompareOp, DateExpr, FilterNode, FlagName, NamePattern, NodeOf } from './ast'
import { parseFilter } from './parser'

const FIELD_LABEL = { date: '날짜', deadline: '마감', created: '생성일' } as const

const FLAG_TEXT: Readonly<Record<FlagName, string>> = {
  recurring: '반복 작업',
  subtask: '하위 작업',
  blocked: '막힌 작업',
  hold: '보류 중',
  someday: '언젠가',
  pinned: '고정됨',
  completed: '완료됨',
  canceled: '취소됨',
  viewAll: '완료·취소 포함 전체 보기',
  all: '전체',
}

const COMPARE_SUFFIX: Readonly<Record<CompareOp, string>> = {
  '>': ' 초과',
  '>=': ' 이상',
  '<': ' 미만',
  '<=': ' 이하',
  '=': '',
}

/** 파싱에 실패하면 빈 문자열 */
export function describeFilter(query: string): string {
  const parsed = parseFilter(query)
  if (!parsed.ok) return ''
  const parts = parsed.ast.map(describeNode)
  if (parts.length === 1) return parts[0]
  return parts.map((part, index) => `${index + 1}번 목록: ${part}`).join(' / ')
}

const wrap = (text: string, shouldWrap: boolean): string => (shouldWrap ? `(${text})` : text)

function describeNode(node: FilterNode): string {
  switch (node.type) {
    case 'and':
      return node.children.map((c) => wrap(describeNode(c), c.type === 'or')).join(' 그리고 ')
    case 'or':
      return node.children.map((c) => wrap(describeNode(c), c.type === 'and')).join(' 또는 ')
    case 'not': {
      const compound = node.child.type === 'and' || node.child.type === 'or' || node.child.type === 'not'
      return `${wrap(describeNode(node.child), compound)} 제외`
    }
    default:
      return describeLeaf(node)
  }
}

type LeafNode = Exclude<FilterNode, NodeOf<'and'> | NodeOf<'or'> | NodeOf<'not'>>

const patternText = (name: NamePattern): string => name.join('*')

function describeLeaf(node: LeafNode): string {
  switch (node.type) {
    case 'date':
      return describeDate(node)
    case 'dateWindow':
      return node.direction === 'next' ? `오늘부터 ${node.days}일 이내` : `최근 ${node.days}일(오늘 포함)`
    case 'overdue':
      return '기한 초과'
    case 'noDate':
      return '날짜 없음'
    case 'noTime':
      return '시간 없음'
    case 'noDeadline':
      return '마감 없음'
    case 'noLabels':
      return '라벨 없음'
    case 'priority':
      return node.level === 4 ? '우선순위 4(기본)' : `우선순위 ${node.level}`
    case 'project':
      return `프로젝트 "${patternText(node.name)}"${node.includeChildren ? '(하위 포함)' : ''}`
    case 'section':
      return `섹션 "${patternText(node.name)}"`
    case 'label':
      return `라벨 "${patternText(node.name)}"`
    case 'flag':
      return FLAG_TEXT[node.flag]
    case 'compare':
      return describeCompare(node)
    case 'search':
      return `제목·설명에 "${node.text}" 포함`
  }
}

function describeOffset(days: number): string {
  const named: Readonly<Record<number, string>> = { [-2]: '그저께', [-1]: '어제', 0: '오늘', 1: '내일', 2: '모레' }
  return named[days] ?? (days > 0 ? `${days}일 후` : `${-days}일 전`)
}

function describeDateExpr(expr: DateExpr): string {
  switch (expr.kind) {
    case 'iso':
      return expr.date
    case 'monthDay':
      return `${expr.month}월 ${expr.day}일`
    case 'offset':
      return describeOffset(expr.days)
    case 'weekday':
      return `${WEEKDAY_KO[expr.weekday]}요일`
    case 'nextWeek':
      return '다음 주 시작일'
  }
}

function describeDate(node: NodeOf<'date'>): string {
  const value = describeDateExpr(node.value)
  // 가장 흔한 "오늘/내일/어제"는 필드 이름 없이 짧게 쓴다.
  const isPlainDay = node.field === 'date' && node.op === 'on' && node.value.kind === 'offset'
  if (isPlainDay && Math.abs(node.value.days) <= 1) return value
  const label = FIELD_LABEL[node.field]
  if (node.op === 'on') return `${label} ${value}`
  return `${label} ${value} ${node.op === 'before' ? '이전' : '이후'}`
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}분`
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`
}

function describeCompare(node: NodeOf<'compare'>): string {
  const suffix = COMPARE_SUFFIX[node.op]
  if (node.field === 'postponed') return `미룬 횟수 ${node.value}회${suffix}`
  return `예상 시간 ${formatMinutes(node.value)}${suffix}`
}
