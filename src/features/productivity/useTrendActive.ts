import { useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { TREND_PADDING } from './chart'
import type { TrendChart } from './chart'

/** 호버(포인터)와 포커스(키보드)로 가리키는 막대 번호와 그 이벤트 핸들러 */
export function useTrendActive(chart: TrendChart) {
  const [hover, setHover] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const last = chart.bars.length - 1
  const clamp = (index: number): number => Math.min(last, Math.max(0, index))

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const slot = (chart.plotRight - chart.plotLeft) / Math.max(1, chart.bars.length)
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left - TREND_PADDING.left
    setHover(clamp(Math.floor(x / slot)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const from = focus ?? last
    const target = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: last }[event.key]
    if (target === undefined) return
    event.preventDefault()
    setHover(null)
    setFocus(clamp(target))
  }

  return {
    activeIndex: hover ?? focus,
    svgHandlers: { onPointerMove, onPointerDown: onPointerMove, onPointerLeave: () => setHover(null) },
    groupHandlers: {
      onKeyDown,
      onFocus: () => setFocus((current) => current ?? last),
      onBlur: () => setFocus(null),
    },
  }
}
