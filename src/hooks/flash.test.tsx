import { render, screen, act } from '@testing-library/react'
import { FLASH_MS, useJustChanged } from './flash'

function Probe({ value }: { value: unknown }) {
  return <p>{useJustChanged(value) ? '반응' : '가만히'}</p>
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useJustChanged', () => {
  it('처음 그려질 때는 반응하지 않는다', () => {
    render(<Probe value={true} />)

    expect(screen.getByText('가만히')).toBeInTheDocument()
  })

  it('값이 바뀌면 잠깐 반응한다', () => {
    const { rerender } = render(<Probe value={false} />)

    rerender(<Probe value={true} />)

    expect(screen.getByText('반응')).toBeInTheDocument()
  })

  it('정해진 시간이 지나면 가라앉는다', () => {
    const { rerender } = render(<Probe value={false} />)
    rerender(<Probe value={true} />)

    act(() => {
      vi.advanceTimersByTime(FLASH_MS)
    })

    expect(screen.getByText('가만히')).toBeInTheDocument()
  })

  it('같은 값으로 다시 그려도 반응하지 않는다', () => {
    const { rerender } = render(<Probe value={'ㄱ'} />)

    rerender(<Probe value={'ㄱ'} />)

    expect(screen.getByText('가만히')).toBeInTheDocument()
  })
})
