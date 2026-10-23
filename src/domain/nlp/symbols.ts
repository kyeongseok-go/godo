// 프로젝트(#), 섹션(/), 라벨(@ %), 우선순위(p1~p4) 기호 인식기.
import type { Priority } from '../types'
import { allMatches, BEFORE_SYMBOL, group, overlaps } from './scan'
import { token, type Hit, type Recognizer } from './state'

interface Named {
  id: string
  name: string
}

const QUOTES: Readonly<Record<string, string>> = { '"': '"', '“': '”' }

function byLengthDesc<T extends Named>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => b.name.length - a.name.length)
}

/**
 * '#' 또는 '/' 바로 뒤의 이름을 읽는다. 따옴표면 닫는 따옴표까지 정확히 일치,
 * 아니면 이름이 입력 앞부분과 일치하는 것 중 가장 긴 것(공백 포함 이름 허용).
 */
function resolveNamed<T extends Named>(
  text: string,
  afterSymbol: number,
  candidates: readonly T[],
): { item: T; end: number } | null {
  const open = text[afterSymbol]
  const close = open === undefined ? undefined : QUOTES[open]
  if (close) {
    const closeAt = text.indexOf(close, afterSymbol + 1)
    if (closeAt < 0) return null
    const quoted = text.slice(afterSymbol + 1, closeAt).trim().toLowerCase()
    const item = quoted ? candidates.find((c) => c.name.toLowerCase() === quoted) : undefined
    return item ? { item, end: closeAt + 1 } : null
  }
  const rest = text.slice(afterSymbol).toLowerCase()
  const item = byLengthDesc(candidates).find((c) => c.name !== '' && rest.startsWith(c.name.toLowerCase()))
  return item ? { item, end: afterSymbol + item.name.length } : null
}

const PROJECT_SYMBOL = new RegExp(`${BEFORE_SYMBOL}#`, 'g')
const SECTION_SYMBOL = new RegExp(`${BEFORE_SYMBOL}/`, 'g')

export const recognizeProject: Recognizer = (text, state, ctx) => {
  if (state.fields.projectId) return []
  for (const m of allMatches(PROJECT_SYMBOL, text)) {
    const found = resolveNamed(text, m.index + 1, ctx.projects)
    if (!found || overlaps(state.claimed, m.index, found.end)) continue
    return [
      {
        token: token('project', text, m.index, found.end, `#${found.item.name}`),
        patch: { projectId: found.item.id },
      },
    ]
  }
  return []
}

export const recognizeSection: Recognizer = (text, state, ctx) => {
  if (state.fields.sectionId) return []
  const projectId = state.fields.projectId
  const preferred = projectId ? ctx.sections.filter((s) => s.projectId === projectId) : []
  for (const m of allMatches(SECTION_SYMBOL, text)) {
    const found =
      resolveNamed(text, m.index + 1, preferred) ?? resolveNamed(text, m.index + 1, ctx.sections)
    if (!found || overlaps(state.claimed, m.index, found.end)) continue
    return [
      {
        token: token('section', text, m.index, found.end, `/${found.item.name}`),
        // 프로젝트를 안 적었으면 섹션이 속한 프로젝트로 정한다
        patch: { sectionId: found.item.id, projectId: found.item.projectId },
      },
    ]
  }
  return []
}

const LABEL_SYMBOL = new RegExp(`${BEFORE_SYMBOL}([@%])([\\p{L}\\p{N}_\\-]+)`, 'gu')

export const recognizeLabels: Recognizer = (text, state, ctx) => {
  const hits: Hit[] = []
  for (const m of allMatches(LABEL_SYMBOL, text)) {
    const name = group(m, 2) ?? ''
    const end = m.index + m[0].length
    if (overlaps(state.claimed, m.index, end)) continue
    const existing = ctx.labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
    hits.push({
      token: token('label', text, m.index, end, `@${existing?.name ?? name}`),
      patch: existing ? { labelIds: [existing.id] } : { newLabelNames: [name] },
    })
  }
  return hits
}

const PRIORITY = new RegExp(`${BEFORE_SYMBOL}[pP]([1-4])(?![A-Za-z0-9_])`, 'g')

export const recognizePriority: Recognizer = (text, state) => {
  if (state.fields.priority) return []
  for (const m of allMatches(PRIORITY, text)) {
    const end = m.index + m[0].length
    if (overlaps(state.claimed, m.index, end)) continue
    const level = Number(group(m, 1)) as Priority
    return [{ token: token('priority', text, m.index, end, `P${level}`), patch: { priority: level } }]
  }
  return []
}
