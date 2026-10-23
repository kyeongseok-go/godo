import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarGrid } from './CalendarGrid'

// 오늘은 2026-10-23(금)
const TODAY = '2026-10-23'

function setup(props: Partial<Parameters<typeof CalendarGrid>[0]> = {}) {
  const onSelect = vi.fn()
  render(<CalendarGrid selected={null} today={TODAY} weekStartsOn={1} onSelect={onSelect} {...props} />)
  return { onSelect }
}

const day = (date: string) => screen.getByRole('gridcell', { name: date })

describe('CalendarGrid', () => {
  test('opens on the month of today and marks today', () => {
    setup()

    expect(screen.getByText('2026년 10월')).toBeInTheDocument()
    expect(day('2026-10-23')).toHaveAttribute('data-today', 'true')
    expect(day('2026-10-22')).toHaveAttribute('data-today', 'false')
  })

  test('opens on the month of the selected date and marks it', () => {
    setup({ selected: '2026-12-25' })

    expect(screen.getByText('2026년 12월')).toBeInTheDocument()
    expect(day('2026-12-25')).toHaveAttribute('aria-selected', 'true')
    expect(day('2026-12-24')).toHaveAttribute('aria-selected', 'false')
  })

  test('shows leading and trailing days of the neighbouring months as outside the month', () => {
    setup()

    expect(day('2026-09-30')).toHaveAttribute('data-out', 'true')
    expect(day('2026-10-01')).toHaveAttribute('data-out', 'false')
    expect(day('2026-11-01')).toHaveAttribute('data-out', 'true')
  })

  test('selects the day that was clicked, even one from the neighbouring month', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup()

    await user.click(day('2026-10-30'))
    await user.click(day('2026-09-30'))

    expect(onSelect.mock.calls).toEqual([['2026-10-30'], ['2026-09-30']])
  })

  test('moves between months with the arrows, across a year boundary', async () => {
    const user = userEvent.setup()
    setup({ selected: '2026-12-25' })

    await user.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByText('2027년 1월')).toBeInTheDocument()
    expect(screen.getByRole('grid', { name: '2027년 1월' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    expect(screen.getByText('2026년 11월')).toBeInTheDocument()
  })

  test('starts the week on Monday or Sunday as configured', () => {
    const { unmount } = render(<CalendarGrid selected={null} today={TODAY} weekStartsOn={1} onSelect={() => {}} />)
    const order = () => screen.getAllByText(/^[일월화수목금토]$/).map((el) => el.textContent)
    expect(order()).toEqual(['월', '화', '수', '목', '금', '토', '일'])
    unmount()

    render(<CalendarGrid selected={null} today={TODAY} weekStartsOn={0} onSelect={() => {}} />)
    expect(order()).toEqual(['일', '월', '화', '수', '목', '금', '토'])
  })

  test('marks the days that were asked to be marked', () => {
    setup({ marked: new Set(['2026-10-05', '2026-10-06']) })

    expect(day('2026-10-05')).toHaveAttribute('data-marked', 'true')
    expect(day('2026-10-07')).toHaveAttribute('data-marked', 'false')
  })
})
