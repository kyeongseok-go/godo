// 범용 CSV 파서·작성기 (RFC 4180). 구분자는 쉼표 고정이다.

const NEEDS_QUOTES = /[",\r\n]/

function escapeCell(cell: string): string {
  return NEEDS_QUOTES.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell
}

// 엑셀·구글 시트는 = + - @ (그리고 탭·CR)로 시작하는 칸을 수식으로 실행한다. 이미 ' 로 시작하는 칸도 같이 다뤄야 되돌릴 때 모호하지 않다.
const FORMULA_START = /^'?[=+\-@\t\r]/

/** 내보낼 글자 칸이 수식으로 읽히지 않게 앞에 ' 를 붙인다. 숫자·날짜 칸에는 쓰지 않는다. */
export function guardFormulaCell(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text
}

/** guardFormulaCell 이 붙인 ' 를 떼어 원래 글자를 되돌린다. 그렇게 만들어지지 않은 칸은 그대로 둔다. */
export function unguardFormulaCell(text: string): string {
  return text.startsWith("'") && FORMULA_START.test(text.slice(1)) ? text.slice(1) : text
}

export function toCsvRow(cells: readonly string[]): string {
  return cells.map(escapeCell).join(',')
}

/**
 * 따옴표 안의 쉼표·줄바꿈, "" 이스케이프, \r\n / \r / \n 줄바꿈을 모두 처리한다.
 * 파일 맨 앞의 BOM 은 버린다(엑셀이 붙이는 경우가 많다). 마지막 줄바꿈 뒤에 빈 행을 만들지 않는다.
 */
export function parseCsvRows(text: string): string[][] {
  const source = text.startsWith('﻿') ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let hasContent = false // 줄바꿈 이후 아직 아무 글자도 읽지 않았으면 false

  const endCell = (): void => {
    row.push(cell)
    cell = ''
  }
  const endRow = (): void => {
    endCell()
    rows.push(row)
    row = []
    hasContent = false
  }

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    hasContent = true

    if (inQuotes) {
      if (ch !== '"') cell += ch
      else if (source[i + 1] === '"') {
        cell += '"'
        i += 1
      } else inQuotes = false
      continue
    }

    if (ch === '"' && cell === '') inQuotes = true
    else if (ch === ',') endCell()
    else if (ch === '\n') endRow()
    else if (ch === '\r') {
      if (source[i + 1] === '\n') i += 1
      endRow()
    } else cell += ch
  }

  if (hasContent) endRow()
  return rows
}
