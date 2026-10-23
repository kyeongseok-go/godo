// 쿼리 값(시간 길이, 횟수)을 읽는 작은 파서들.

const UNIT_PART = '(시간|분|hours?|hrs?|h|minutes?|mins?|m)'
const MAX_MINUTES = 100_000_000
const MAX_COUNT = 1_000_000

/** `30m` `1h30m` `1시간 30분` `45`(단위 없으면 분) → 분. 읽을 수 없으면 null */
export function parseDurationMin(input: string): number | null {
  const text = input.trim().toLowerCase()
  if (text === '') return null
  if (/^\d+(\.\d+)?$/.test(text)) return capMinutes(Number(text))

  const part = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT_PART}`, 'y')
  let pos = 0
  let total = 0
  while (pos < text.length) {
    if (text[pos] === ' ') {
      pos += 1
      continue
    }
    part.lastIndex = pos
    const match = part.exec(text)
    if (!match) return null
    const perUnit = match[2].startsWith('h') || match[2] === '시간' ? 60 : 1
    total += Number(match[1]) * perUnit
    pos = part.lastIndex
  }
  return capMinutes(total)
}

function capMinutes(minutes: number): number | null {
  return Number.isFinite(minutes) && minutes <= MAX_MINUTES ? Math.round(minutes) : null
}

/** 0 이상의 정수. 아니면 null */
export function parseCount(input: string): number | null {
  const text = input.trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return value <= MAX_COUNT ? value : null
}
