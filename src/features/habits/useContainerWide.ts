import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/** 요소의 너비가 minPx 이상인지 추적한다. ResizeObserver 가 없는 환경(테스트)에서는 넓다고 본다. */
export function useContainerWide(ref: RefObject<HTMLElement | null>, minPx: number): boolean {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= minPx))
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, minPx])
  return wide
}
