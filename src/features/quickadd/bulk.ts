// 여러 줄 붙여넣기를 계층 구조로 풀어낸다. 들여쓰기(공백 2칸 또는 탭)가 하위 작업이 된다.

export interface BulkLine {
  text: string
  depth: number
}

const INDENT_WIDTH = 2
const MARKER = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/

function indentOf(line: string): number {
  let width = 0
  for (const ch of line) {
    if (ch === ' ') width += 1
    else if (ch === '\t') width += INDENT_WIDTH
    else break
  }
  return Math.floor(width / INDENT_WIDTH)
}

/** 빈 줄을 건너뛰고, 목록 기호와 체크박스를 떼고, 한 번에 두 단계 이상 깊어지지 않게 보정한다. */
export function splitBulkLines(text: string): BulkLine[] {
  const out: BulkLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const body = trimmed.replace(MARKER, '').trim()
    if (!body) continue
    const previous = out[out.length - 1]
    const maxDepth = previous ? previous.depth + 1 : 0
    out.push({ text: body, depth: Math.min(indentOf(raw), maxDepth) })
  }
  return out
}
