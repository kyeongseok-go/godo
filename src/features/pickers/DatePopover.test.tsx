import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { presetRule } from '../../domain/recurrence'
import type { RecurrenceRule } from '../../domain/types'
import { installHiddenPanelFocusShim } from '../../test/focusShim'
import { renderApp, resetApp } from '../../test/render'
import { DateButton } from './PickerButtons'
import type { SchedulePatch } from './DatePopover'

installHiddenPanelFocusShim()

// 오늘은 2026-10-23(금), 한 주는 월요일에 시작한다.
beforeEach(async () => {
  await resetApp()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-23T09:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

const EMPTY: SchedulePatch = { startDate: null, startTime: null, durationMin: null, dayPart: null, recurrence: null, someday: false }
const weekly = (byWeekday: RecurrenceRule['byWeekday'], interval = 1): RecurrenceRule => ({
  freq: 'weekly',
  interval,
  byWeekday,
  anchor: 'due',
  end: { type: 'never' },
  resetSubtasks: false,
})

function Harness({ initial = {}, onPatch }: { initial?: Partial<SchedulePatch>; onPatch?: (p: Partial<SchedulePatch>) => void }) {
  const [value, setValue] = useState<SchedulePatch>({ ...EMPTY, ...initial })
  return (
    <DateButton
      value={value}
      onChange={(patch) => {
        onPatch?.(patch)
        setValue((prev) => ({ ...prev, ...patch }))
      }}
    />
  )
}

async function openPopover(user: ReturnType<typeof userEvent.setup>, trigger: string | RegExp = '날짜') {
  await user.click(screen.getByRole('button', { name: trigger }))
  return screen.findByRole('dialog', { name: '날짜 선택' })
}

describe('DateButton summary', () => {
  test.each([
    ['nothing scheduled', {}, '날짜'],
    ['today', { startDate: '2026-10-23' }, '오늘'],
    ['a date with a time', { startDate: '2026-10-24', startTime: '14:30' as const }, '내일 · 14:30'],
    ['a date with a part of the day', { startDate: '2026-10-23', dayPart: 'evening' as const }, '오늘 · 저녁'],
    ['someday', { someday: true }, '언젠가'],
    ['a repeating rule', { startDate: '2026-10-23', recurrence: weekly([5]) }, '오늘 · 매주 금요일'],
  ])('reads %s', (_name, initial, expected) => {
    renderApp(<Harness initial={initial} />)
    expect(screen.getByRole('button', { name: expected })).toBeInTheDocument()
  })
})

// 빠른 선택 칩은 달력의 '다음 달' 이동 버튼보다 앞에 나온다.
const quickChip = (pop: HTMLElement, label: string) => within(pop).getAllByRole('button', { name: label })[0]

describe('keyboard', () => {
  test('moves focus into the popover so it can be reached without tabbing the page', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    const pop = await openPopover(user)

    expect(pop.contains(document.activeElement)).toBe(true)
    expect(quickChip(pop, '오늘')).toHaveFocus()
  })

  test('Escape closes the popover and gives focus back to the button', async () => {
    const user = userEvent.setup()
    renderApp(<Harness />)
    await openPopover(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '날짜 선택' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '날짜' })).toHaveFocus()
  })
})

describe('quick dates', () => {
  test.each([
    ['오늘', '2026-10-23'],
    ['내일', '2026-10-24'],
    ['이번 주말', '2026-10-24'],
    ['다음 주', '2026-10-26'],
    ['다음 달', '2026-11-23'],
  ])('“%s” schedules %s', async (label, date) => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness onPatch={onPatch} />)
    const pop = await openPopover(user)

    await user.click(quickChip(pop, label))

    expect(onPatch).toHaveBeenLastCalledWith({ startDate: date, someday: false })
  })

  test('“날짜 없음” clears the date together with time, part of day and repeat', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness initial={{ startDate: '2026-10-23', startTime: '09:00', recurrence: weekly([5]) }} onPatch={onPatch} />)
    const pop = await openPopover(user, /오늘/)

    await user.click(within(pop).getByRole('button', { name: '날짜 없음' }))

    expect(onPatch).toHaveBeenLastCalledWith({ startDate: null, someday: false, startTime: null, dayPart: null, recurrence: null })
    expect(screen.getByRole('button', { name: '날짜' })).toBeInTheDocument()
  })

  test('“언젠가” turns on someday and drops the date, and picking a date turns it off again', async () => {
    const user = userEvent.setup()
    renderApp(<Harness initial={{ startDate: '2026-10-23' }} />)
    const pop = await openPopover(user, '오늘')

    await user.click(quickChip(pop, '언젠가'))
    expect(quickChip(pop, '언젠가')).toHaveAttribute('data-active', 'true')
    expect(quickChip(pop, '오늘')).toHaveAttribute('data-active', 'false')

    await user.click(quickChip(pop, '내일'))
    expect(quickChip(pop, '언젠가')).toHaveAttribute('data-active', 'false')
    expect(quickChip(pop, '내일')).toHaveAttribute('data-active', 'true')
  })

  test('clicking a day in the calendar picks that date', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness onPatch={onPatch} />)
    const pop = await openPopover(user)

    await user.click(within(pop).getByRole('gridcell', { name: '2026-10-30' }))

    expect(onPatch).toHaveBeenLastCalledWith({ startDate: '2026-10-30', someday: false })
    expect(screen.getByRole('button', { name: '10월 30일 (금)' })).toBeInTheDocument()
  })
})

describe('time of day', () => {
  test('setting a time defaults the date to today, drops the part of day and shows the duration', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness initial={{ dayPart: 'morning' }} onPatch={onPatch} />)
    const pop = await openPopover(user, '오전')
    expect(within(pop).getByRole('group', { name: '하루 중 구간' })).toBeInTheDocument()

    fireEvent.change(within(pop).getByLabelText('시각'), { target: { value: '14:30' } })

    expect(onPatch).toHaveBeenLastCalledWith({ startTime: '14:30', startDate: '2026-10-23', dayPart: null })
    expect(within(pop).queryByRole('group', { name: '하루 중 구간' })).not.toBeInTheDocument()
    expect(within(pop).getByLabelText('소요 시간')).toBeInTheDocument()
  })

  test('picks a duration and wipes both time and duration with the clear button', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness initial={{ startDate: '2026-10-23', startTime: '14:30' }} onPatch={onPatch} />)
    const pop = await openPopover(user, /14:30/)

    await user.selectOptions(within(pop).getByLabelText('소요 시간'), '1시간 30분')
    expect(onPatch).toHaveBeenLastCalledWith({ durationMin: 90 })

    await user.selectOptions(within(pop).getByLabelText('소요 시간'), '없음')
    expect(onPatch).toHaveBeenLastCalledWith({ durationMin: null })

    await user.click(within(pop).getByRole('button', { name: '시각 지우기' }))
    expect(onPatch).toHaveBeenLastCalledWith({ startTime: null, durationMin: null })
    expect(within(pop).getByRole('group', { name: '하루 중 구간' })).toBeInTheDocument()
  })

  test('toggles a part of the day on and off, scheduling today when no date was set', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness onPatch={onPatch} />)
    const pop = await openPopover(user)
    const afternoon = within(pop).getByRole('button', { name: '오후' })

    await user.click(afternoon)
    expect(onPatch).toHaveBeenLastCalledWith({ dayPart: 'afternoon', startDate: '2026-10-23' })
    expect(afternoon).toHaveAttribute('aria-pressed', 'true')

    await user.click(afternoon)
    expect(onPatch).toHaveBeenLastCalledWith({ dayPart: null, startDate: '2026-10-23' })
    expect(afternoon).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('repeat presets', () => {
  test.each([
    ['매일', { freq: 'daily', interval: 1 }],
    ['평일마다', { freq: 'weekly', byWeekday: [1, 2, 3, 4, 5] }],
    ['매주', { freq: 'weekly', byWeekday: [5] }],
    ['매월', { freq: 'monthly', byMonthDay: 23 }],
    ['매년', { freq: 'yearly' }],
  ])('“%s” sets the rule and falls back to today as the start', async (label, rule) => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness onPatch={onPatch} />)
    const pop = await openPopover(user)

    await user.selectOptions(within(pop).getByLabelText('반복'), label)

    expect(onPatch).toHaveBeenLastCalledWith({ recurrence: expect.objectContaining(rule), startDate: '2026-10-23' })
    expect(within(pop).getByLabelText('반복')).toHaveValue(label === '평일마다' ? 'weekdays' : { 매일: 'daily', 매주: 'weekly', 매월: 'monthly', 매년: 'yearly' }[label])
  })

  test('shows a plain summary for a preset rule and “반복 안 함” removes it', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness initial={{ startDate: '2026-10-23', recurrence: presetRule('weekdays', '2026-10-23') }} onPatch={onPatch} />)
    const pop = await openPopover(user, /평일/)
    expect(within(pop).getByLabelText('반복')).toHaveValue('weekdays')
    expect(within(pop).queryByLabelText('반복 단위')).not.toBeInTheDocument()

    await user.selectOptions(within(pop).getByLabelText('반복'), '반복 안 함')

    expect(onPatch).toHaveBeenLastCalledWith({ recurrence: null })
    expect(screen.queryByRole('button', { name: /평일/ })).not.toBeInTheDocument()
  })

  test('“사용자 지정…” opens the editor on top of the current rule and edits flow back', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    renderApp(<Harness initial={{ startDate: '2026-10-23' }} onPatch={onPatch} />)
    const pop = await openPopover(user, '오늘')

    await user.selectOptions(within(pop).getByLabelText('반복'), '사용자 지정…')
    const interval = within(pop).getByLabelText('매')
    fireEvent.change(interval, { target: { value: '3' } })

    expect(onPatch).toHaveBeenLastCalledWith({ recurrence: expect.objectContaining({ freq: 'weekly', interval: 3 }) })
    expect(within(pop).getByLabelText('반복')).toHaveValue('custom')
  })

  test('clearing the date also leaves “사용자 지정…” instead of keeping an editor-less custom state', async () => {
    const user = userEvent.setup()
    renderApp(<Harness initial={{ startDate: '2026-10-23' }} />)
    const pop = await openPopover(user, '오늘')
    await user.selectOptions(within(pop).getByLabelText('반복'), '사용자 지정…')
    expect(within(pop).getByLabelText('반복 단위')).toBeInTheDocument()

    await user.click(within(pop).getByRole('button', { name: '날짜 없음' }))

    expect(within(pop).getByLabelText('반복')).toHaveValue('none')
    expect(within(pop).queryByLabelText('반복 단위')).not.toBeInTheDocument()
  })

  test('a rule that matches no preset opens straight into the editor so it can be changed', async () => {
    const user = userEvent.setup()
    renderApp(<Harness initial={{ startDate: '2026-10-23', recurrence: weekly([2, 4], 2) }} />)
    const pop = await openPopover(user, /2주마다|화·목/)

    expect(within(pop).getByLabelText('반복')).toHaveValue('custom')
    expect(within(pop).getByLabelText('반복 단위')).toHaveValue('weekly')
    expect(within(pop).getByRole('button', { name: '화' })).toHaveAttribute('aria-pressed', 'true')
  })
})
