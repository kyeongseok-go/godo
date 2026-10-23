// 문자 단위 스캐너. 파서는 키워드마다 값의 모양이 달라서(날짜는 공백 포함, 이름은 이스케이프)
// 토큰화를 미리 하지 않고 이 커서로 필요한 만큼만 읽는다.
import type { FilterNode } from './ast'

export class ParseFailure extends Error {
  readonly position: number

  constructor(message: string, position: number) {
    super(message)
    this.name = 'ParseFailure'
    this.position = position
  }
}

/** 파서 내부 상태. pos는 읽는 위치, last는 직전에 읽은 조건(오류 안내용) */
export class Cursor {
  readonly src: string
  pos = 0
  last: FilterNode | null = null

  constructor(src: string) {
    this.src = src
  }
}

const WHITESPACE = /\s/
/** 이름·검색어가 끝나는 문자(공백 포함). 그 밖의 특수문자는 `\` 로 이스케이프한다. */
const NAME_STOP = new Set(['(', ')', '&', '|', ','])
/** 키워드 단어가 끝나는 문자 */
const WORD_STOP = new Set(['(', ')', '&', '|', ',', '!', ':', '"', '<', '>', '='])
/** 날짜·시간 값이 끝나는 문자 */
const VALUE_STOP = new Set(['(', ')', '&', '|', ',', '!'])

export const isWhitespace = (ch: string): boolean => WHITESPACE.test(ch)
const isWordChar = (ch: string): boolean => !isWhitespace(ch) && !WORD_STOP.has(ch)

export function skipWhitespace(cursor: Cursor): void {
  while (cursor.pos < cursor.src.length && isWhitespace(cursor.src[cursor.pos])) cursor.pos += 1
}

/** 끝이면 빈 문자열 */
export const peek = (cursor: Cursor): string => cursor.src[cursor.pos] ?? ''

export interface Word {
  text: string
  start: number
  end: number
  /** 이 단어 뒤(공백 건너뛰고)에 ':' 가 있으면 그 위치, 없으면 -1 */
  colonPos: number
}

/**
 * 현재 위치부터 공백으로 나뉜 단어를 최대 max개 미리 본다(커서는 움직이지 않는다).
 * "date before:" 같은 여러 단어 키워드를 길이별로 맞춰 보려는 용도다.
 */
export function peekWords(cursor: Cursor, max: number): Word[] {
  const { src } = cursor
  const words: Word[] = []
  let i = cursor.pos
  while (words.length < max) {
    while (i < src.length && isWhitespace(src[i])) i += 1
    const start = i
    while (i < src.length && isWordChar(src[i])) i += 1
    if (i === start) break
    let j = i
    while (j < src.length && isWhitespace(src[j])) j += 1
    const colonPos = src[j] === ':' ? j : -1
    words.push({ text: src.slice(start, i), start, end: i, colonPos })
    if (colonPos >= 0) break
  }
  return words
}

/**
 * 이름·검색어를 읽는다. `\x` 는 x 그대로, 따옴표 모드에서는 닫는 따옴표까지.
 * wildcard가 true이면 이스케이프하지 않은 `*` 로 조각을 나눈다(반환 배열이 조각).
 */
export function readSegments(cursor: Cursor, quoted: boolean, wildcard: boolean): string[] {
  const { src } = cursor
  const open = cursor.pos
  const segments: string[] = []
  let buffer = ''
  if (quoted) cursor.pos += 1
  for (;;) {
    if (cursor.pos >= src.length) {
      if (quoted) throw new ParseFailure('끝나지 않은 따옴표입니다', open)
      break
    }
    const ch = src[cursor.pos]
    if (quoted ? ch === '"' : isWhitespace(ch) || NAME_STOP.has(ch)) {
      if (quoted) cursor.pos += 1
      break
    }
    if (ch === '\\') {
      if (cursor.pos + 1 >= src.length) {
        throw new ParseFailure('이스케이프(\\) 뒤에 문자가 필요합니다', cursor.pos)
      }
      buffer += src[cursor.pos + 1]
      cursor.pos += 2
      continue
    }
    if (wildcard && ch === '*') {
      segments.push(buffer)
      buffer = ''
    } else {
      buffer += ch
    }
    cursor.pos += 1
  }
  segments.push(buffer)
  return segments
}

/** 날짜·시간 값처럼 공백이 들어갈 수 있는 값을 연산자 앞까지 읽는다. */
export function readValueText(cursor: Cursor): { text: string; start: number } {
  skipWhitespace(cursor)
  const start = cursor.pos
  while (cursor.pos < cursor.src.length && !VALUE_STOP.has(cursor.src[cursor.pos])) cursor.pos += 1
  return { text: cursor.src.slice(start, cursor.pos).trim(), start }
}
