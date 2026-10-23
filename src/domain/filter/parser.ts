// 문법: query := group (',' group)*   group := or   or := and ('|' and)*
//       and := not ('&' not)*        not := '!' not | '(' or ')' | atom
// 우선순위는 ! > & > |. 최상위 쉼표만 묶음을 나눈다.
import { parseAtom } from './atoms'
import type { FilterNode, ParseResult } from './ast'
import { Cursor, ParseFailure, peek, skipWhitespace } from './cursor'

const MAX_DEPTH = 64
const OPERATOR_CHARS = new Set(['&', '|', ','])

export function parseFilter(query: string): ParseResult {
  try {
    return { ok: true, ast: parseQuery(query) }
  } catch (error: unknown) {
    if (error instanceof ParseFailure) {
      return { ok: false, error: { message: error.message, position: error.position } }
    }
    throw error
  }
}

function parseQuery(query: string): FilterNode[] {
  const cursor = new Cursor(query)
  skipWhitespace(cursor)
  if (cursor.pos >= query.length) throw new ParseFailure('조건이 비어 있습니다', 0)

  const groups: FilterNode[] = []
  let after = ''
  for (;;) {
    groups.push(parseOr(cursor, 0, after))
    skipWhitespace(cursor)
    if (cursor.pos >= query.length) return groups
    if (peek(cursor) !== ',') throw unexpected(cursor)
    cursor.pos += 1
    after = ','
  }
}

/** after: 이 조건 바로 앞의 연산자(없으면 ''). 조건이 빠졌을 때 안내 문구에 쓴다. */
function parseOr(cursor: Cursor, depth: number, after: string): FilterNode {
  const children = [parseAnd(cursor, depth, after)]
  for (;;) {
    skipWhitespace(cursor)
    if (peek(cursor) !== '|') break
    cursor.pos += 1
    children.push(parseAnd(cursor, depth, '|'))
  }
  return children.length === 1 ? children[0] : { type: 'or', children }
}

function parseAnd(cursor: Cursor, depth: number, after: string): FilterNode {
  const children = [parseNot(cursor, depth, after)]
  for (;;) {
    skipWhitespace(cursor)
    if (peek(cursor) !== '&') break
    cursor.pos += 1
    children.push(parseNot(cursor, depth, '&'))
  }
  return children.length === 1 ? children[0] : { type: 'and', children }
}

function parseNot(cursor: Cursor, depth: number, after: string): FilterNode {
  skipWhitespace(cursor)
  if (peek(cursor) !== '!') return parsePrimary(cursor, depth, after)
  if (depth + 1 > MAX_DEPTH) throw tooDeep(cursor)
  cursor.pos += 1
  return { type: 'not', child: parseNot(cursor, depth + 1, '!') }
}

function parsePrimary(cursor: Cursor, depth: number, after: string): FilterNode {
  skipWhitespace(cursor)
  const ch = peek(cursor)
  if (ch === '(') return parseGroup(cursor, depth)
  if (ch === '' || ch === ')' || OPERATOR_CHARS.has(ch)) throw missingOperand(cursor, after)
  return parseAtom(cursor)
}

function parseGroup(cursor: Cursor, depth: number): FilterNode {
  const open = cursor.pos
  if (depth + 1 > MAX_DEPTH) throw tooDeep(cursor)
  cursor.pos += 1
  skipWhitespace(cursor)
  if (peek(cursor) === ')') throw new ParseFailure('괄호 안에 조건이 없습니다', cursor.pos)
  const inner = parseOr(cursor, depth + 1, '')
  skipWhitespace(cursor)
  const ch = peek(cursor)
  if (ch === ')') {
    cursor.pos += 1
    return inner
  }
  if (ch === '') throw new ParseFailure('"("에 대응하는 ")"가 없습니다', open)
  if (ch === ',') {
    throw new ParseFailure('괄호 안에서는 쉼표(,)로 목록을 나눌 수 없습니다', cursor.pos)
  }
  throw unexpected(cursor)
}

const tooDeep = (cursor: Cursor): ParseFailure =>
  new ParseFailure('조건이 너무 깊게 중첩되어 있습니다', cursor.pos)

const OPERATOR_LABEL: Readonly<Record<string, string>> = {
  '&': '"&"',
  '|': '"|"',
  ',': '쉼표(,)',
  '!': '"!"',
}

/** 조건이 와야 할 자리에 조건이 아닌 것이 왔다. */
function missingOperand(cursor: Cursor, after: string): ParseFailure {
  const ch = peek(cursor)
  if (ch === '' || ch === ')') {
    const message = after
      ? `${OPERATOR_LABEL[after]} 뒤에 조건이 필요합니다`
      : ch === ')'
        ? '괄호 안에 조건이 없습니다'
        : '조건이 필요합니다'
    return new ParseFailure(message, cursor.pos)
  }
  return new ParseFailure(`${OPERATOR_LABEL[ch]} 앞에 조건이 필요합니다`, cursor.pos)
}

/** 조건 하나를 다 읽었는데 연산자가 아닌 문자가 이어진다. */
function unexpected(cursor: Cursor): ParseFailure {
  const ch = peek(cursor)
  if (ch === ')') return new ParseFailure('짝이 없는 ")"입니다', cursor.pos)
  if (ch === ':') return new ParseFailure('예상하지 못한 ":"입니다', cursor.pos)
  const hint = cursor.last?.type === 'search' ? ' (공백이 있는 검색어는 따옴표로 묶어 주세요)' : ''
  return new ParseFailure(`조건 사이에는 "&"(그리고) 또는 "|"(또는)가 필요합니다${hint}`, cursor.pos)
}
