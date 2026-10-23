import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { useApp } from '../../store/app'
import { makeTask } from '../../test/factories'
import { CapacityMeter } from './CapacityMeter'
import { planOf, seedStore } from './testUtils'

const DAY = '2026-03-10'

describe('CapacityMeter', () => {
  beforeEach(() => {
    seedStore([])
  })

  it('shows planned time against the default capacity', () => {
    seedStore([makeTask({ startDate: DAY, estimateMin: 330 })])
    render(<CapacityMeter date={DAY} />)
    expect(screen.getByText('5시간 30분')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /하루 용량 6시간/ })).toHaveTextContent('6시간')
    expect(screen.getByText('거의 찼어요')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: '계획한 시간' })).toHaveAttribute('aria-valuenow', '330')
  })

  it('says how much overflowed and marks the section as over', () => {
    seedStore([makeTask({ startDate: DAY, estimateMin: 440 })])
    const { container } = render(<CapacityMeter date={DAY} />)
    expect(screen.getByText('1시간 20분 넘쳤어요')).toBeInTheDocument()
    expect(container.querySelector('.capmeter')).toHaveAttribute('data-level', 'over')
  })

  it('counts only the given day', () => {
    seedStore([makeTask({ startDate: '2026-03-11', estimateMin: 600 })])
    render(<CapacityMeter date={DAY} />)
    expect(screen.getByText('아직 비어 있어요')).toBeInTheDocument()
  })

  it('uses the per-day capacity when one is stored', () => {
    seedStore([], [{ date: DAY, capacityMin: 180, highlightIds: [], morningDoneAt: null, eveningDoneAt: null, reflection: '' }])
    render(<CapacityMeter date={DAY} />)
    expect(screen.getByRole('button', { name: /하루 용량 3시간/ })).toBeInTheDocument()
  })

  it('changes the capacity for that day only, through the popover', async () => {
    const user = userEvent.setup()
    render(<CapacityMeter date={DAY} />)
    await user.click(screen.getByRole('button', { name: /하루 용량 6시간/ }))
    const input = screen.getByLabelText('이 날 용량 (시간)')
    await user.clear(input)
    await user.type(input, '4.5')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(planOf(DAY)?.capacityMin).toBe(270)
    expect(screen.getByRole('button', { name: /하루 용량 4시간 30분/ })).toBeInTheDocument()
  })

  it('refuses an invalid capacity and explains why', async () => {
    const user = userEvent.setup()
    render(<CapacityMeter date={DAY} />)
    await user.click(screen.getByRole('button', { name: /하루 용량 6시간/ }))
    const input = screen.getByLabelText('이 날 용량 (시간)')
    await user.clear(input)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByRole('alert')).toHaveTextContent('0보다 크고 24 이하')
    expect(planOf(DAY)).toBeUndefined()
  })

  it('goes back to the default with the reset button', async () => {
    seedStore([], [{ date: DAY, capacityMin: 180, highlightIds: [], morningDoneAt: null, eveningDoneAt: null, reflection: '' }])
    const user = userEvent.setup()
    render(<CapacityMeter date={DAY} />)
    await user.click(screen.getByRole('button', { name: /하루 용량 3시간/ }))
    await user.click(screen.getByRole('button', { name: '기본값으로' }))
    expect(planOf(DAY)?.capacityMin).toBeNull()
  })

  it('can be undone from the shared history', async () => {
    const user = userEvent.setup()
    render(<CapacityMeter date={DAY} />)
    await user.click(screen.getByRole('button', { name: /하루 용량 6시간/ }))
    await user.clear(screen.getByLabelText('이 날 용량 (시간)'))
    await user.type(screen.getByLabelText('이 날 용량 (시간)'), '5')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(useApp.getState().undoStack.at(-1)?.label).toBe('하루 용량 변경')
  })
})
