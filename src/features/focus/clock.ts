const SEC = 1_000
const MIN = 60
const HOUR = 3_600

function toWholeSeconds(ms: number, direction: 'down' | 'up'): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  // 카운트다운은 올림: 0.4초 남았어도 00:01 로 보여야 00:00 이 곧 완료를 뜻한다.
  return direction === 'down' ? Math.ceil(ms / SEC) : Math.floor(ms / SEC)
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** 타이머 숫자. 1시간 미만은 MM:SS, 이상은 H:MM:SS. */
export function formatClock(ms: number, direction: 'down' | 'up'): string {
  const total = toWholeSeconds(ms, direction)
  const h = Math.floor(total / HOUR)
  const m = Math.floor((total % HOUR) / MIN)
  const s = total % MIN
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** 스크린 리더용 한국어 읽기. 초 단위가 의미 없는 1시간 이상은 분까지만. */
export function spokenTime(ms: number): string {
  const total = toWholeSeconds(ms, 'down')
  const h = Math.floor(total / HOUR)
  const m = Math.floor((total % HOUR) / MIN)
  const s = total % MIN
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
  if (m > 0) return s > 0 ? `${m}분 ${s}초` : `${m}분`
  return `${s}초`
}
