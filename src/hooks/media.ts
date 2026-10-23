import { useEffect, useState } from 'react'

/** 손에 들고 보는 폭. CSS 의 폰 전용 규칙과 같은 값이어야 한다. */
export const PHONE_QUERY = '(max-width: 40rem)'
/** 사이드바가 서랍으로 바뀌는 폭. shell.css 의 전환 지점과 같은 값이어야 한다. */
export const DRAWER_QUERY = '(max-width: 56rem)'

/**
 * 미디어 쿼리가 지금 맞는지 알려준다.
 * matchMedia 가 없는 환경(테스트 등)에서는 넓은 화면으로 본다 — 기능이 사라지는 쪽보다 안전하다.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    setMatches(list.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}
