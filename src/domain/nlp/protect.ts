// URL·이메일은 기호나 날짜로 읽지 않도록 통째로 보호 구간으로 잡는다.
import { allMatches, spanOf, type Span } from './scan'

const URL_LIKE = /(?:https?:\/\/|www\.)\S+/giu
const EMAIL_LIKE = /\S+@\S+\.\S+/gu

export function protectedSpans(text: string): Span[] {
  return [...allMatches(URL_LIKE, text), ...allMatches(EMAIL_LIKE, text)].map(spanOf)
}
