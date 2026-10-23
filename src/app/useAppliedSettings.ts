import { useEffect } from 'react'
import { useApp } from '../store/app'
import { isDefaultAccent } from '../store/defaults'

/** 설정(테마·강조색·밀도)을 <html>에 반영한다. 자동 테마는 data-theme을 비워 OS 설정을 따른다. */
export function useAppliedSettings(): void {
  const theme = useApp((s) => s.settings.theme)
  const accent = useApp((s) => s.settings.accent)
  const density = useApp((s) => s.settings.density)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    // 기본 강조색이면 테마별 토큰(라이트/다크)을 그대로 쓴다. 직접 고른 색만 덮어쓴다.
    // 직접 고른 색은 라이트에서는 그대로, 다크에서는 흰색과 섞어 밝혀 쓴다(tokens.css 참고).
    if (isDefaultAccent(accent)) {
      root.style.removeProperty('--accent-custom')
      root.style.removeProperty('--accent-custom-dark')
    } else {
      root.style.setProperty('--accent-custom', accent)
      root.style.setProperty('--accent-custom-dark', `color-mix(in oklab, ${accent} 55%, white)`)
    }
  }, [accent])

  useEffect(() => {
    const root = document.documentElement
    if (density === 'compact') root.setAttribute('data-density', 'compact')
    else root.removeAttribute('data-density')
  }, [density])
}
