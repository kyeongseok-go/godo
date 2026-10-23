// 강조색 프리셋. 팔레트에서 읽기 좋은 색만 골라 낸다. 순수 함수.

export const ACCENT_PRESET_COUNT = 6

const WHITE = '#ffffff'
const PAPER_LIGHT = '#f4efe4'
const PAPER_DARK = '#15130f'

// 기준: 강조색 위에 얹는 흰 글자(13px 버튼)는 AA 4.5:1 이상.
// 종이색 위에서 글자·아이콘으로 쓰일 때는 3.5:1 이상, 다크 종이 위에서는 형체가 읽히는 2:1 이상.
const MIN_LABEL_ON_ACCENT = 4.5
const MIN_ACCENT_ON_PAPER = 3.5
const MIN_ACCENT_ON_DARK = 2

const NAMES: Readonly<Record<string, string>> = {
  '#c8360f': '주홍',
  '#d9421c': '주홍',
  '#2f6f5e': '숲 초록',
  '#2b4c7e': '남색',
  '#b8860b': '황금빛',
  '#7a3e8e': '자주',
  '#c2185b': '진분홍',
  '#00796b': '청록',
  '#5d4037': '갈색',
  '#455a64': '청회색',
  '#6b6258': '먹회색',
}

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((c) => c + c).join('') : match[1]
  const value = Number.parseInt(digits, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 명암비(1~21). 색 표기가 올바르지 않으면 NaN. */
export function contrastRatio(a: string, b: string): number {
  const rgbA = parseHex(a)
  const rgbB = parseHex(b)
  if (!rgbA || !rgbB) return Number.NaN
  const [hi, lo] = [luminance(rgbA), luminance(rgbB)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export function isAccentReadable(hex: string): boolean {
  return (
    contrastRatio(hex, WHITE) >= MIN_LABEL_ON_ACCENT &&
    contrastRatio(hex, PAPER_LIGHT) >= MIN_ACCENT_ON_PAPER &&
    contrastRatio(hex, PAPER_DARK) >= MIN_ACCENT_ON_DARK
  )
}

/** 팔레트 순서대로 읽기 좋은 색을 최대 6개 고른다. */
export function accentPresets(palette: readonly string[]): string[] {
  return palette.filter(isAccentReadable).slice(0, ACCENT_PRESET_COUNT)
}

export function accentName(hex: string): string {
  return NAMES[hex.toLowerCase()] ?? '사용자 지정'
}
