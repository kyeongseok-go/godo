/**
 * 브랜드 마크: 고텍이(GoTechy) 블로그의 블록 G.
 * 네 조각이 서로 맞물려 G 를 이루고, 색은 브랜드 고정값이라 테마를 따르지 않는다.
 * 파비콘·앱 아이콘(public/favicon.svg)과 같은 도형을 쓴다.
 */
export function GodoMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      className="godo-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(4 0)">
        <path
          fill="#016473"
          d="M24 0 H35.1 a6 6 0 0 1 6 6 V19 a6 6 0 0 1-6 6 H34.3 a8 8 0 0 0-8 8 V42.6 a2 2 0 0 1-2 2 H2 a2 2 0 0 1-2-2 V24 A24 24 0 0 1 24 0 Z"
        />
        <rect fill="#49d6f3" x="44.4" y="0" width="32.8" height="23.2" rx="8" />
        <path
          fill="#484bcb"
          d="M2 50 H24.3 a2 2 0 0 1 2 2 V61.6 a8 8 0 0 0 8 8 H38.4 a6 6 0 0 1 6 6 V94 a6 6 0 0 1-6 6 H24 A24 24 0 0 1 0 76 V52 a2 2 0 0 1 2-2 Z"
        />
        <path
          fill="#01a0a5"
          d="M50.4 44.6 H86 a6 6 0 0 1 6 6 V86 a14 14 0 0 1-14 14 H68.6 V68.7 a8 8 0 0 0-8-8 H50.4 a6 6 0 0 1-6-6 V50.6 a6 6 0 0 1 6-6 Z"
        />
        <rect fill="#035f68" x="47.7" y="69.6" width="20.9" height="30.4" rx="2" />
      </g>
    </svg>
  )
}
