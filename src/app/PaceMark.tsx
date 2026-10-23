/**
 * 브랜드 마크: 하루를 다섯 눈금으로 본뜬 모양. 가운데 호박색 눈금이 "지금"이다.
 * 파비콘·앱 아이콘(public/favicon.svg)과 같은 도형을 쓴다.
 */
export function PaceMark({ size = 20 }: { size?: number }) {
  const scale = size / 20
  return (
    <svg
      className="pace-mark"
      width={24 * scale}
      height={size}
      viewBox="0 0 24 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="10" width="3" height="10" rx="1.5" />
      <rect x="5.25" y="6" width="3" height="14" rx="1.5" />
      <rect x="10.5" y="1" width="3" height="19" rx="1.5" className="pace-mark__now" />
      <rect x="15.75" y="7.5" width="3" height="12.5" rx="1.5" />
      <rect x="21" y="12" width="3" height="8" rx="1.5" />
    </svg>
  )
}
