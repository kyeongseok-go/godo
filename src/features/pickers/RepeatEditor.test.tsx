import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { presetRule } from '../../domain/recurrence'
import type { RecurrenceRule } from '../../domain/types'
import { RepeatEditor } from './RepeatEditor'

// 시작일은 2026-10-23(금)
const START = '2026-10-23'

function Harness({ initial, onRule }: { initial: RecurrenceRule; onRule?: (r: RecurrenceRule) => void }) {
  const [rule, setRule] = useState(initial)
  return (
    <RepeatEditor
      rule={rule}
      startDate={START}
      onChange={(next) => {
        onRule?.(next)
        setRule(next)
      }}
    />
  )
}

const summary = () => screen.getByText((_, el) => el?.className === 'repeat__summary')

function setup(initial: RecurrenceRule) {
  const onRule = vi.fn<(r: RecurrenceRule) => void>()
  render(<Harness initial={initial} onRule={onRule} />)
  return { onRule, last: () => onRule.mock.lastCall?.[0] as RecurrenceRule }
}

describe('RepeatEditor', () => {
  describe('interval and unit', () => {
    test('changes the interval and describes it right away', () => {
      const { last } = setup(presetRule('daily', START))

      fireEvent.change(screen.getByLabelText('매'), { target: { value: '3' } })

      expect(last().interval).toBe(3)
      expect(summary()).toHaveTextContent('3일마다')
    })

    test('can be emptied to retype, and is corrected to one only when leaving the field', () => {
      const { onRule, last } = setup({ ...presetRule('daily', START), interval: 4 })
      const field = screen.getByLabelText('매')

      // 지운 순간 1 로 바뀌어 버리면 이어서 3 을 눌렀을 때 "13" 이 된다.
      fireEvent.change(field, { target: { value: '' } })
      expect(field).toHaveValue(null)
      expect(onRule).not.toHaveBeenCalled()

      fireEvent.change(field, { target: { value: '3' } })
      expect(last().interval).toBe(3)
      expect(field).toHaveValue(3)
    })

    test('never commits an interval below one', () => {
      const { onRule, last } = setup({ ...presetRule('daily', START), interval: 4 })
      const field = screen.getByLabelText('매')

      fireEvent.change(field, { target: { value: '0' } })
      expect(onRule).not.toHaveBeenCalled()

      fireEvent.blur(field)
      expect(last().interval).toBe(1)
      expect(field).toHaveValue(1)
    })

    test('leaving an emptied interval field puts one back', () => {
      const { last } = setup({ ...presetRule('daily', START), interval: 4 })
      const field = screen.getByLabelText('매')

      fireEvent.change(field, { target: { value: '' } })
      fireEvent.blur(field)

      expect(last().interval).toBe(1)
      expect(field).toHaveValue(1)
    })

    test('switching the unit keeps interval, anchor, end and subtask reset but rebuilds the pattern', async () => {
      const user = userEvent.setup()
      const rule: RecurrenceRule = { ...presetRule('weekly', START), interval: 2, anchor: 'completion', end: { type: 'count', count: 5 }, resetSubtasks: true }
      const { last } = setup(rule)

      await user.selectOptions(screen.getByLabelText('반복 단위'), '개월')

      expect(last()).toMatchObject({
        freq: 'monthly',
        interval: 2,
        anchor: 'completion',
        end: { type: 'count', count: 5 },
        resetSubtasks: true,
        byMonthDay: 23,
      })
      expect(last().byWeekday).toBeUndefined()
      expect(summary()).toHaveTextContent('2개월마다')
    })
  })

  describe('weekdays', () => {
    test('only shows the weekday buttons for weekly rules', () => {
      setup(presetRule('daily', START))
      expect(screen.queryByRole('group', { name: '요일' })).not.toBeInTheDocument()
    })

    test('toggles weekdays on and off', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('weekly', START))
      const tue = screen.getByRole('button', { name: '화' })
      expect(screen.getByRole('button', { name: '금' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(tue)
      expect(tue).toHaveAttribute('aria-pressed', 'true')
      expect(last().byWeekday).toEqual([5, 2])
      expect(summary()).toHaveTextContent('화·금')

      await user.click(tue)
      expect(last().byWeekday).toEqual([5])
    })

    test('turning off the last weekday falls back to the start date weekday', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('weekly', START))

      await user.click(screen.getByRole('button', { name: '금' }))

      expect(last().byWeekday).toBeUndefined()
      expect(summary()).toHaveTextContent('금요일')
    })

    test('lists the week from Monday to Sunday', () => {
      setup(presetRule('weekly', START))
      const days = screen.getByRole('group', { name: '요일' })
      expect(Array.from(days.querySelectorAll('button'), (b) => b.textContent)).toEqual(['월', '화', '수', '목', '금', '토', '일'])
    })
  })

  describe('monthly mode', () => {
    test('moves between same date, last day and nth weekday', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('monthly', START))
      const mode = screen.getByLabelText('매월 기준')
      expect(mode).toHaveValue('day')

      await user.selectOptions(mode, '마지막 날')
      expect(last()).toMatchObject({ byMonthDay: 'last' })
      expect(last().nth).toBeUndefined()
      expect(mode).toHaveValue('last')
      expect(summary()).toHaveTextContent('마지막 날')

      await user.selectOptions(mode, 'n번째 요일')
      expect(last().nth).toEqual({ n: 4, weekday: 5 })
      expect(last().byMonthDay).toBeUndefined()
      expect(mode).toHaveValue('nth')
      expect(summary()).toHaveTextContent('넷째 금요일')

      await user.selectOptions(mode, '같은 날짜')
      expect(last().byMonthDay).toBe(23)
      expect(last().nth).toBeUndefined()
    })

    test('is hidden for other units', () => {
      setup(presetRule('yearly', START))
      expect(screen.queryByLabelText('매월 기준')).not.toBeInTheDocument()
    })
  })

  describe('anchor and subtasks', () => {
    test('chooses what the next occurrence is based on', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('daily', START))

      await user.selectOptions(screen.getByLabelText('다음 회차 기준'), '완료한 날 기준')

      expect(last().anchor).toBe('completion')
    })

    test('toggles resetting subtasks', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('daily', START))

      await user.click(screen.getByRole('checkbox', { name: /하위 작업을 처음 상태로/ }))

      expect(last().resetSubtasks).toBe(true)
    })
  })

  describe('end condition', () => {
    test('ending on a date starts from the start date and accepts a new one', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('daily', START))

      await user.selectOptions(screen.getByLabelText('종료'), '날짜까지')
      expect(last().end).toEqual({ type: 'until', date: START })
      expect(screen.getByLabelText('종료 날짜')).toHaveValue(START)

      fireEvent.change(screen.getByLabelText('종료 날짜'), { target: { value: '2026-12-31' } })
      expect(last().end).toEqual({ type: 'until', date: '2026-12-31' })
      expect(summary()).toHaveTextContent('2026-12-31까지')
    })

    test('ignores an emptied end date field', async () => {
      const user = userEvent.setup()
      const { onRule } = setup(presetRule('daily', START))
      await user.selectOptions(screen.getByLabelText('종료'), '날짜까지')
      onRule.mockClear()

      fireEvent.change(screen.getByLabelText('종료 날짜'), { target: { value: '' } })

      expect(onRule).not.toHaveBeenCalled()
    })

    test('ending after a number of times defaults to ten and never goes below one', async () => {
      const user = userEvent.setup()
      const { last } = setup(presetRule('daily', START))

      await user.selectOptions(screen.getByLabelText('종료'), '횟수만큼')
      expect(last().end).toEqual({ type: 'count', count: 10 })

      fireEvent.change(screen.getByLabelText('반복 횟수'), { target: { value: '3' } })
      expect(last().end).toEqual({ type: 'count', count: 3 })
      expect(summary()).toHaveTextContent('3회')

      fireEvent.change(screen.getByLabelText('반복 횟수'), { target: { value: '0' } })
      fireEvent.blur(screen.getByLabelText('반복 횟수'))
      expect(last().end).toEqual({ type: 'count', count: 1 })
    })

    test('the number of times can be emptied to retype and is corrected when leaving the field', async () => {
      const user = userEvent.setup()
      const { onRule, last } = setup(presetRule('daily', START))
      await user.selectOptions(screen.getByLabelText('종료'), '횟수만큼')
      const field = screen.getByLabelText('반복 횟수')
      onRule.mockClear()

      fireEvent.change(field, { target: { value: '' } })
      expect(field).toHaveValue(null)
      expect(onRule).not.toHaveBeenCalled()

      fireEvent.change(field, { target: { value: '4' } })
      expect(last().end).toEqual({ type: 'count', count: 4 })

      fireEvent.change(field, { target: { value: '' } })
      fireEvent.blur(field)
      expect(last().end).toEqual({ type: 'count', count: 1 })
    })

    test('going back to “계속” removes the extra field', async () => {
      const user = userEvent.setup()
      const { last } = setup({ ...presetRule('daily', START), end: { type: 'count', count: 4 } })

      await user.selectOptions(screen.getByLabelText('종료'), '계속')

      expect(last().end).toEqual({ type: 'never' })
      expect(screen.queryByLabelText('반복 횟수')).not.toBeInTheDocument()
    })
  })

  test('shows the validation message instead of the summary for an impossible rule', () => {
    setup({ ...presetRule('monthly', START), byMonthDay: 40 })

    expect(summary()).toHaveAttribute('data-invalid', 'true')
    expect(summary()).toHaveTextContent('1~31')
  })

  test('marks a valid rule as valid', () => {
    setup(presetRule('daily', START))
    expect(summary()).toHaveAttribute('data-invalid', 'false')
  })
})
