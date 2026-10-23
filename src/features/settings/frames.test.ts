import { describe, expect, it } from 'vitest'
import {
  addFrame,
  describeFrameMatch,
  FRAME_PRESETS,
  frameProblem,
  framesFromPresets,
  MAX_FRAMES,
  newFrame,
  patchFrame,
  removeFrame,
  toggleFrameDay,
  toggleFrameLabel,
  toggleFramePriority,
} from './frames'
import type { Label, TimeFrame } from '../../domain/types'

const base = (patch: Partial<TimeFrame> = {}): TimeFrame => ({ ...newFrame('f1', []), ...patch })

const label = (id: string, name: string): Label => ({ id, name, color: '#000', order: 0 })

describe('newFrame', () => {
  it('order 는 기존 가장 큰 값보다 크다', () => {
    const frames = [base({ id: 'a', order: 5000 })]
    expect(newFrame('b', frames).order).toBeGreaterThan(5000)
  })

  it('기본값은 평일 오전이고 조건이 없다', () => {
    const frame = newFrame('a', [])
    expect(frame.days).toEqual([1, 2, 3, 4, 5])
    expect(frame.match).toEqual({ labelIds: [], priorities: [], minMinutes: null })
  })
})

describe('목록 편집', () => {
  it('추가·삭제·수정이 원본을 바꾸지 않는다', () => {
    const frames = [base({ id: 'a' })]
    const added = addFrame(frames, newFrame('b', frames))
    expect(frames).toHaveLength(1)
    expect(added).toHaveLength(2)
    expect(removeFrame(added, 'a').map((f) => f.id)).toEqual(['b'])
    expect(patchFrame(added, 'a', { name: '딥워크' })[0]?.name).toBe('딥워크')
    expect(frames[0]?.name).toBe('새 시간대')
  })

  it('id 는 수정으로 바꿀 수 없다', () => {
    const frames = [base({ id: 'a' })]
    expect(patchFrame(frames, 'a', { id: 'hacked' } as Partial<TimeFrame>)[0]?.id).toBe('a')
  })

  it('최대 개수를 넘기면 더 추가하지 않는다', () => {
    const many = Array.from({ length: MAX_FRAMES }, (_, i) => base({ id: `f${i}` }))
    expect(addFrame(many, newFrame('extra', many))).toHaveLength(MAX_FRAMES)
  })

  it('요일은 켜고 끌 수 있고 정렬된 상태를 지킨다', () => {
    const frames = [base({ id: 'a', days: [3] })]
    expect(toggleFrameDay(frames, 'a', 1)[0]?.days).toEqual([1, 3])
    expect(toggleFrameDay(frames, 'a', 3)[0]?.days).toEqual([])
  })

  it('라벨과 우선순위 조건을 켜고 끈다', () => {
    const frames = [base({ id: 'a' })]
    const withLabel = toggleFrameLabel(frames, 'a', 'L1')
    expect(withLabel[0]?.match.labelIds).toEqual(['L1'])
    expect(toggleFrameLabel(withLabel, 'a', 'L1')[0]?.match.labelIds).toEqual([])
    const withP = toggleFramePriority(toggleFramePriority(frames, 'a', 4), 'a', 1)
    expect(withP[0]?.match.priorities).toEqual([1, 4])
  })

  it('다른 시간대는 건드리지 않는다', () => {
    const frames = [base({ id: 'a' }), base({ id: 'b' })]
    expect(toggleFrameDay(frames, 'a', 6)[1]).toBe(frames[1])
  })
})

describe('frameProblem', () => {
  it('문제가 없으면 null', () => {
    expect(frameProblem(base())).toBeNull()
  })

  it('이름이 비었거나 요일이 없으면 알려준다', () => {
    expect(frameProblem(base({ name: '  ' }))).toContain('이름')
    expect(frameProblem(base({ days: [] }))).toContain('요일')
  })

  it('끝이 시작보다 빠르면 알려준다', () => {
    expect(frameProblem(base({ start: '12:00', end: '09:00' }))).toContain('종료')
    expect(frameProblem(base({ start: '12:00', end: '12:00' }))).toContain('종료')
  })

  it('최소 길이가 시간대보다 길면 알려준다', () => {
    const frame = base({ start: '09:00', end: '10:00', match: { labelIds: [], priorities: [], minMinutes: 120 } })
    expect(frameProblem(frame)).toContain('최소 길이')
  })
})

describe('describeFrameMatch', () => {
  const labels = [label('L1', '딥워크'), label('L2', '잡무')]

  it('조건이 없으면 모든 일', () => {
    expect(describeFrameMatch(base(), labels)).toBe('모든 일')
  })

  it('라벨·우선순위·최소 길이를 모아 적는다', () => {
    const frame = base({ match: { labelIds: ['L1'], priorities: [1, 2], minMinutes: 60 } })
    expect(describeFrameMatch(frame, labels)).toBe('@딥워크 · P1, P2 · 60분 이상')
  })

  it('지워진 라벨도 자리를 비우지 않는다', () => {
    const frame = base({ match: { labelIds: ['gone'], priorities: [], minMinutes: null } })
    expect(describeFrameMatch(frame, labels)).toContain('사라진 라벨')
  })
})

describe('framesFromPresets', () => {
  it('준 id 수만큼만 만들고 순서를 매긴다', () => {
    const frames = framesFromPresets(FRAME_PRESETS, ['a', 'b'])
    expect(frames.map((f) => [f.id, f.name])).toEqual([
      ['a', '딥워크'],
      ['b', '잡무'],
    ])
    expect(frames[0]?.order).toBeLessThan(frames[1]?.order ?? 0)
    expect(frames.every((f) => frameProblem(f) === null)).toBe(true)
  })

  it('id 가 모자라면 그만큼만 만든다', () => {
    expect(framesFromPresets(FRAME_PRESETS, ['only'])).toHaveLength(1)
  })

  it('프리셋 배열을 공유하지 않는다', () => {
    const frames = framesFromPresets(FRAME_PRESETS, ['a', 'b'])
    frames[0]?.days.push(0)
    expect(FRAME_PRESETS[0]?.days).toEqual([1, 2, 3, 4, 5])
  })
})
