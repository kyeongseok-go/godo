// 파서 전체가 공유하는 위치(span)·경계 정규식 도구.
export interface Span {
  start: number
  end: number
}

/** 기호(#,/,@,%,p1,~,!)는 앞이 공백이거나 문장 시작일 때만 기호다. */
export const BEFORE_SYMBOL = '(?<!\\S)'

/** 날짜·시간·반복 단어는 시작, 공백, 여는 괄호·따옴표·쉼표 뒤에서만 시작한다. */
export const BEFORE_WORD = '(?<![^\\s(\\[{"\'“‘,;])'

/** 영어 단어 뒤 경계 */
export const EN_END = '(?![\\p{L}\\p{N}_])'

/** 한국어 단어 뒤 경계: 조사 하나는 구 안으로 삼키고, 한글이 더 이어지면 단어가 아니다. '까지'는 마감 판정을 위해 남겨 둔다. */
export const KO_END = '(?:에는|에|은|는|도|부터)?(?:(?![\\p{L}\\p{N}])|(?=까지))'

export function overlaps(claimed: readonly Span[], start: number, end: number): boolean {
  return claimed.some((s) => start < s.end && end > s.start)
}

/** 전역 정규식의 모든 일치. 원본 정규식의 lastIndex는 건드리지 않는다. */
export function allMatches(re: RegExp, text: string): RegExpExecArray[] {
  return Array.from(text.matchAll(re))
}

export function group(m: RegExpExecArray, i: number): string | undefined {
  return m[i] as string | undefined
}

export function spanOf(m: RegExpExecArray): Span {
  return { start: m.index, end: m.index + m[0].length }
}
