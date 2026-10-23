import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** 요소의 실제 너비(px). 측정이 안 되는 환경(테스트 등)에서는 fallback 을 쓴다. */
export function useElementWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => setWidth(Math.round(element.getBoundingClientRect().width) || fallback)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fallback])

  return [ref, width]
}
