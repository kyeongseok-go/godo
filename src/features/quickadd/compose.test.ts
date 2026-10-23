import type { ParsedQuickAdd } from '../../domain/nlp/types'
import { INBOX_ID } from '../../domain/types'
import { defaultSettings } from '../../store/defaults'
import { composeTask } from './compose'
import type { ComposeArgs } from './compose'

const parsedBase: ParsedQuickAdd = {
  title: '회의',
  startDate: null,
  startTime: null,
  dayPart: null,
  dueDate: null,
  durationMin: null,
  estimateMin: null,
  priority: null,
  projectId: null,
  sectionId: null,
  labelIds: [],
  newLabelNames: [],
  recurrence: null,
  reminderOffsetsMin: [],
  tokens: [],
}

const args = (over: Omit<Partial<ComposeArgs>, 'parsed'> & { parsed?: Partial<ParsedQuickAdd> } = {}): ComposeArgs => ({
  parsed: { ...parsedBase, ...over.parsed },
  manual: over.manual ?? {},
  defaults: over.defaults ?? {},
  settings: over.settings ?? defaultSettings(),
  today: '2026-10-23',
})

describe('composeTask', () => {
  test('falls back to the inbox with priority 4 when nothing is specified', () => {
    const { input } = composeTask(args())

    expect(input).toMatchObject({ title: '회의', projectId: INBOX_ID, priority: 4, startDate: null, sectionId: null })
  })

  test('manual picks beat parsed values, which beat view defaults', () => {
    const { input } = composeTask(
      args({
        parsed: { projectId: 'parsed', priority: 2 },
        manual: { projectId: 'manual' },
        defaults: { projectId: 'default' },
      }),
    )

    expect(input.projectId).toBe('manual')
    expect(input.priority).toBe(2)
  })

  test('uses the view default project and section when nothing else is chosen', () => {
    const { input } = composeTask(args({ defaults: { projectId: 'p', sectionId: 's' } }))

    expect(input).toMatchObject({ projectId: 'p', sectionId: 's' })
  })

  test('drops the default section when the project changes', () => {
    const { input } = composeTask(args({ defaults: { projectId: 'p', sectionId: 's' }, parsed: { projectId: 'other' } }))

    expect(input).toMatchObject({ projectId: 'other', sectionId: null })
  })

  test('applies a start date from the view default, or today per settings', () => {
    expect(composeTask(args({ defaults: { startDate: '2026-10-25' } })).input.startDate).toBe('2026-10-25')
    expect(composeTask(args({ settings: { ...defaultSettings(), defaultStartDate: 'today' } })).input.startDate).toBe('2026-10-23')
  })

  test('parsed date wins over defaults and a manual clear wins over parsed', () => {
    expect(composeTask(args({ parsed: { startDate: '2026-11-01' }, defaults: { startDate: '2026-10-25' } })).input.startDate).toBe('2026-11-01')
    expect(composeTask(args({ parsed: { startDate: '2026-11-01' }, manual: { schedule: { startDate: null } } })).input.startDate).toBeNull()
  })

  test('someday clears the start date', () => {
    const { input } = composeTask(args({ parsed: { startDate: '2026-11-01' }, manual: { schedule: { someday: true } } }))

    expect(input.someday).toBe(true)
    expect(input.startDate).toBeNull()
  })

  test('a time of day replaces any day part', () => {
    const { input } = composeTask(args({ parsed: { startDate: '2026-10-24', startTime: '15:00', dayPart: 'afternoon' } }))

    expect(input.dayPart).toBeNull()
    expect(input.startTime).toBe('15:00')
  })

  test('parsed reminders become relative reminders, only when there is a date', () => {
    const withDate = composeTask(args({ parsed: { startDate: '2026-10-24', reminderOffsetsMin: [30, 5] } })).input
    expect(withDate.reminders?.map((r) => (r.kind === 'relative' ? r.offsetMin : -1))).toEqual([30, 5])

    const noDate = composeTask(args({ parsed: { reminderOffsetsMin: [30] } })).input
    expect(noDate.reminders).toEqual([])
  })

  test('the default reminder offset applies only to timed tasks', () => {
    const settings = { ...defaultSettings(), defaultReminderOffsetMin: 10 }

    const timed = composeTask(args({ settings, parsed: { startDate: '2026-10-24', startTime: '09:00' } })).input
    const dateOnly = composeTask(args({ settings, parsed: { startDate: '2026-10-24' } })).input

    expect(timed.reminders).toHaveLength(1)
    expect(dateOnly.reminders).toEqual([])
  })

  test('manual labels replace parsed labels and suppress label creation', () => {
    const { input, newLabelNames } = composeTask(
      args({ parsed: { labelIds: ['a'], newLabelNames: ['새라벨'] }, manual: { labelIds: ['b'] } }),
    )

    expect(input.labelIds).toEqual(['b'])
    expect(newLabelNames).toEqual([])
  })

  test('passes new label names through when labels are not picked manually', () => {
    expect(composeTask(args({ parsed: { newLabelNames: ['새라벨'] } })).newLabelNames).toEqual(['새라벨'])
  })

  test('carries the parent id for subtask creation', () => {
    expect(composeTask(args({ defaults: { parentId: 'parent' } })).input.parentId).toBe('parent')
  })
})
