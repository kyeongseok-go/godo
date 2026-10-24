import { useEffect, useRef, useState } from 'react'

/** 반응이 눈에 남아 있는 시간. 손을 뗀 뒤 "방금 눌렸구나"가 읽힐 만큼만 짧게 둔다. */
export const FLASH_MS = 520

/**
 * 값이 바뀐 직후에만 잠깐 true 가 된다. 처음 그려질 때는 울리지 않는다.
 *
 * 목록을 다시 열 때 이미 끝난 일들이 한꺼번에 반응하면 안 되기 때문에,
 * "지금 화면에서 방금 바뀐 것"과 "원래 그 상태였던 것"을 반드시 갈라야 한다.
 */
export function useJustChanged(value: unknown, ms: number = FLASH_MS): boolean {
  const previous = useRef(value)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (Object.is(previous.current, value)) return
    previous.current = value
    setActive(true)
    const timer = window.setTimeout(() => setActive(false), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])

  return active
}
