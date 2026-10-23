import {
  DEFAULT_POSTPONE_THRESHOLD,
  DEFAULT_STALE_DAYS,
  parseReviewParams,
  POSTPONE_RANGE,
  STALE_DAYS_RANGE,
  writeReviewParams,
} from './params'

const q = (search: string) => new URLSearchParams(search)

describe('parseReviewParams', () => {
  test('defaults to 14 idle days and 3 postponements', () => {
    expect(parseReviewParams(q(''))).toEqual({ staleDays: DEFAULT_STALE_DAYS, postponeThreshold: DEFAULT_POSTPONE_THRESHOLD })
    expect(DEFAULT_STALE_DAYS).toBe(14)
    expect(DEFAULT_POSTPONE_THRESHOLD).toBe(3)
  })

  test('reads both values', () => {
    expect(parseReviewParams(q('stale=30&postponed=5'))).toEqual({ staleDays: 30, postponeThreshold: 5 })
  })

  test('clamps out-of-range values', () => {
    expect(parseReviewParams(q('stale=0&postponed=500'))).toEqual({
      staleDays: STALE_DAYS_RANGE.min,
      postponeThreshold: POSTPONE_RANGE.max,
    })
  })

  test('falls back to the defaults for garbage and rounds decimals', () => {
    expect(parseReviewParams(q('stale=abc&postponed=')).staleDays).toBe(DEFAULT_STALE_DAYS)
    expect(parseReviewParams(q('stale=&postponed=')).postponeThreshold).toBe(DEFAULT_POSTPONE_THRESHOLD)
    expect(parseReviewParams(q('stale=10.6')).staleDays).toBe(11)
  })
})

describe('writeReviewParams', () => {
  test('writes nothing for the defaults', () => {
    expect(writeReviewParams({ staleDays: 14, postponeThreshold: 3 }).toString()).toBe('')
  })

  test('writes only values that differ and round-trips', () => {
    const written = writeReviewParams({ staleDays: 30, postponeThreshold: 3 })

    expect(written.toString()).toBe('stale=30')
    expect(parseReviewParams(written)).toEqual({ staleDays: 30, postponeThreshold: 3 })
  })

  test('keeps unrelated keys and does not touch the base', () => {
    const base = q('task=abc&stale=99')

    const written = writeReviewParams({ staleDays: 14, postponeThreshold: 6 }, base)

    expect(written.get('task')).toBe('abc')
    expect(written.has('stale')).toBe(false)
    expect(written.get('postponed')).toBe('6')
    expect(base.get('stale')).toBe('99')
  })
})
