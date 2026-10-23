import { describe, expect, it } from 'vitest'
import { makeProject } from '../../test/factories'
import { defaultSettings } from '../../store/defaults'
import { dateFormatSample, homeOptions, projectOptions, reminderLabel, reminderOptions, timeZoneOptions } from './options'

const modules = defaultSettings().modules

describe('homeOptions', () => {
  it('lists the built-in screens first, then projects in a group', () => {
    const options = homeOptions('today', [makeProject({ id: 'b', name: '나', order: 2 }), makeProject({ id: 'a', name: '가', order: 1 })], modules)

    expect(options.slice(0, 5).map((o) => o.value)).toEqual(['today', 'inbox', 'upcoming', 'now', 'all'])
    expect(options.filter((o) => o.group === '프로젝트').map((o) => [o.value, o.label])).toEqual([
      ['project:a', '가'],
      ['project:b', '나'],
    ])
  })

  it('hides folders, archived and deleted projects', () => {
    const options = homeOptions(
      'today',
      [makeProject({ id: 'f', isFolder: true }), makeProject({ id: 'x', archived: true }), makeProject({ id: 'd', deletedAt: 1 }), makeProject({ id: 'ok' })],
      modules,
    )

    expect(options.filter((o) => o.group === '프로젝트').map((o) => o.value)).toEqual(['project:ok'])
  })

  it('offers calendar and matrix only while their modules are on', () => {
    const off = { ...modules, calendar: false, matrix: false }

    expect(homeOptions('today', [], off).map((o) => o.value)).not.toContain('calendar')
    expect(homeOptions('today', [], modules).map((o) => o.value)).toContain('calendar')
  })

  it('keeps the current value visible even if it no longer exists', () => {
    const options = homeOptions('project:gone', [], modules)

    expect(options.at(-1)).toEqual({ value: 'project:gone', label: '찾을 수 없는 화면 (오늘로 열려요)' })
  })

  it('keeps a disabled module option when it is the current value', () => {
    const options = homeOptions('calendar', [], { ...modules, calendar: false })

    expect(options.map((o) => o.value)).toContain('calendar')
  })
})

describe('projectOptions', () => {
  it('puts the inbox first and skips folders and deleted projects', () => {
    const inbox = makeProject({ id: 'inbox', name: '받은편지함', order: -1 })
    const options = projectOptions([makeProject({ id: 'z', name: 'Z', order: 5 }), inbox, makeProject({ id: 'f', isFolder: true }), makeProject({ id: 'd', deletedAt: 1 })], 'inbox')

    expect(options.map((o) => o.value)).toEqual(['inbox', 'z'])
  })

  it('keeps the current project even when archived', () => {
    const options = projectOptions([makeProject({ id: 'a', archived: true, name: '보관' })], 'a')

    expect(options.map((o) => o.value)).toEqual(['a'])
  })
})

describe('timeZoneOptions', () => {
  it('uses the supplied list, adds UTC and the current zone, and sorts', () => {
    const list = timeZoneOptions('Asia/Seoul', ['Europe/Paris', 'Asia/Tokyo'])

    expect(list).toEqual(['Asia/Seoul', 'Asia/Tokyo', 'Europe/Paris', 'UTC'])
  })

  it('does not duplicate the current zone', () => {
    expect(timeZoneOptions('Asia/Tokyo', ['Asia/Tokyo', 'UTC'])).toEqual(['Asia/Tokyo', 'UTC'])
  })

  it('falls back to a short list without Intl.supportedValuesOf', () => {
    const list = timeZoneOptions('Asia/Seoul', null)

    expect(list).toContain('Asia/Seoul')
    expect(list).toContain('America/New_York')
  })
})

describe('reminderLabel and reminderOptions', () => {
  it('describes offsets in Korean', () => {
    expect(reminderLabel(0)).toBe('정각')
    expect(reminderLabel(10)).toBe('10분 전')
    expect(reminderLabel(60)).toBe('1시간 전')
    expect(reminderLabel(1440)).toBe('1일 전')
    expect(reminderLabel(90)).toBe('90분 전')
  })

  it('starts with "사용 안 함" and adds an unusual current value', () => {
    const options = reminderOptions(45)

    expect(options[0]).toEqual({ value: 'none', label: '사용 안 함' })
    expect(options.map((o) => o.value)).toContain('45')
  })

  it('does not duplicate a standard value', () => {
    const values = reminderOptions(10).map((o) => o.value)

    expect(values.filter((v) => v === '10')).toHaveLength(1)
  })
})

describe('dateFormatSample', () => {
  it('shows an unambiguous sample for each format', () => {
    expect(dateFormatSample('YMD')).toBe('2026-03-24')
    expect(dateFormatSample('MDY')).toBe('03/24/2026')
    expect(dateFormatSample('DMY')).toBe('24/03/2026')
  })
})
