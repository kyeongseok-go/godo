import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { useApp } from '../../store/app'
import { DEFAULT_ACCENT } from '../../store/defaults'
import { resetApp } from '../../test/render'
import { makeProject } from '../../test/factories'
import { renderSettings } from './testKit'

beforeEach(async () => {
  await resetApp()
})

const settings = () => useApp.getState().settings

describe('SettingsView routing', () => {
  test('shows the tab named in the URL and marks it as current', async () => {
    renderSettings('modules')

    expect(await screen.findByRole('heading', { level: 2, name: '사이드바·모듈' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /사이드바·모듈/ })).toHaveAttribute('aria-current', 'page')
  })

  test('has a link for each of the eight tabs', () => {
    renderSettings('general')

    const nav = screen.getByRole('navigation', { name: '설정 구역' })
    expect(within(nav).getAllByRole('link')).toHaveLength(8)
  })

  test('redirects an unknown tab to the first tab', async () => {
    renderSettings('nope')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/settings/general'))
  })

  test('navigates between tabs through the links', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(screen.getByRole('link', { name: /모양/ }))

    expect(await screen.findByRole('heading', { level: 2, name: '모양' })).toBeInTheDocument()
  })

  // 이 두 탭은 lazy 로 불러온다. 전체 스위트를 병렬로 돌리면 기본 1초를 넘길 수 있다.
  const LAZY_TIMEOUT = { timeout: 15000 }

  test('loads the data and templates tabs on demand', async () => {
    const user = userEvent.setup()
    renderSettings('data')
    expect(
      await screen.findByRole('button', { name: /JSON 백업 내려받기/ }, LAZY_TIMEOUT),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /템플릿/ }))

    expect(await screen.findByText('저장한 템플릿', undefined, LAZY_TIMEOUT)).toBeInTheDocument()
  })

  test('renders the notifications body from the notifications module', () => {
    renderSettings('notifications')

    expect(screen.getByRole('heading', { level: 2, name: '알림' })).toBeInTheDocument()
  })
})

describe('GeneralTab', () => {
  test('saves the week start immediately', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.click(screen.getByRole('radio', { name: '일요일' }))

    expect(settings().weekStartsOn).toBe(0)
    expect(screen.getByRole('radio', { name: '일요일' })).toBeChecked()
  })

  test('moves the radio selection with arrow keys', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    screen.getByRole('radio', { name: '24시간' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(settings().timeFormat).toBe('12h')
    expect(screen.getByRole('radio', { name: '12시간' })).toHaveFocus()
  })

  test('saves the time zone and day start hour from selects', async () => {
    const user = userEvent.setup()
    renderSettings('general')

    await user.selectOptions(screen.getByLabelText('시간대'), 'UTC')
    await user.selectOptions(screen.getByLabelText('하루가 시작되는 시각'), '3')

    expect(settings().timeZone).toBe('UTC')
    expect(settings().dayStartHour).toBe(3)
  })

  test('lists projects for the home screen and stores project:<id>', async () => {
    const user = userEvent.setup()
    useApp.getState().commit({ puts: { projects: [makeProject({ id: 'work', name: '업무' })] }, deletes: {} }, '준비', { history: false })
    renderSettings('general')

    await user.selectOptions(screen.getByLabelText('앱을 열면 처음 보이는 화면'), 'project:work')

    expect(settings().homeView).toBe('project:work')
  })

  test('stores a reminder offset and null for none', async () => {
    const user = userEvent.setup()
    renderSettings('general')
    const select = screen.getByLabelText('알림 시점')

    await user.selectOptions(select, '15')
    expect(settings().defaultReminderOffsetMin).toBe(15)

    await user.selectOptions(select, 'none')
    expect(settings().defaultReminderOffsetMin).toBeNull()
  })

  test('toggles smart parsing with a switch', async () => {
    const user = userEvent.setup()
    renderSettings('general')
    const toggle = screen.getByRole('switch', { name: '스마트 날짜 인식' })

    await user.click(toggle)

    expect(settings().smartParsing).toBe(false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('saves a valid number and ignores one out of range', async () => {
    const user = userEvent.setup()
    renderSettings('general')
    const duration = screen.getByLabelText('기본 길이')

    await user.clear(duration)
    await user.type(duration, '45')
    expect(settings().defaultDurationMin).toBe(45)

    await user.clear(duration)
    await user.type(duration, '1000')
    expect(settings().defaultDurationMin).toBe(100)
    expect(await screen.findByRole('alert')).toHaveTextContent('5에서 720 사이의 정수로 입력해 주세요')
  })

  test('snaps an invalid draft back to the saved value on blur', async () => {
    const user = userEvent.setup()
    renderSettings('general')
    const buffer = screen.getByLabelText('블록 사이 여유')

    await user.clear(buffer)
    await user.tab()

    expect(buffer).toHaveValue(settings().bufferMin)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('refuses a work end time that is not after the start', () => {
    renderSettings('general')
    const end = screen.getByLabelText('근무 종료')

    fireEvent.change(end, { target: { value: '08:00' } })

    expect(settings().workEnd).toBe('18:00')
    expect(screen.getByRole('alert')).toHaveTextContent('종료 시각은 시작 시각보다 늦어야 해요')
  })

  test('saves a valid work end time', () => {
    renderSettings('general')

    fireEvent.change(screen.getByLabelText('근무 종료'), { target: { value: '19:30' } })

    expect(settings().workEnd).toBe('19:30')
  })
})

describe('AppearanceTab', () => {
  test('applies the theme choice to the settings right away', async () => {
    const user = userEvent.setup()
    renderSettings('appearance')

    await user.click(screen.getByRole('radio', { name: /다크/ }))

    expect(settings().theme).toBe('dark')
  })

  test('offers six accent presets and saves the picked one', async () => {
    const user = userEvent.setup()
    renderSettings('appearance')
    const group = screen.getByRole('radiogroup', { name: '강조색' })

    expect(within(group).getAllByRole('radio')).toHaveLength(6)
    expect(within(group).getByRole('radio', { name: '청록' })).toBeChecked()

    await user.click(within(group).getByRole('radio', { name: '파랑' }))

    expect(settings().accent).toBe('#2f6fd0')
    expect(within(group).getByRole('radio', { name: '파랑' })).toBeChecked()
  })

  test('treats the legacy default accent as the default swatch', () => {
    useApp.setState((s) => ({ settings: { ...s.settings, accent: '#d9421c' } }))
    renderSettings('appearance')

    expect(screen.getByRole('radio', { name: '청록' })).toBeChecked()
  })

  test('switches density', async () => {
    const user = userEvent.setup()
    renderSettings('appearance')

    await user.click(screen.getByRole('radio', { name: '촘촘' }))

    expect(settings().density).toBe('compact')
  })

  test('shows a read-only preview row', () => {
    renderSettings('appearance')

    const preview = screen.getByRole('complementary', { name: '미리보기' })
    expect(within(preview).getByText('분기 보고서 초안 작성')).toBeInTheDocument()
  })

  test('keeps the default accent constant exported by the store', () => {
    expect(settings().accent).toBe(DEFAULT_ACCENT)
  })
})

describe('ModulesTab', () => {
  test('turns a module off and on without touching the others', async () => {
    const user = userEvent.setup()
    renderSettings('modules')
    const calendar = screen.getByRole('switch', { name: '캘린더' })

    await user.click(calendar)

    expect(settings().modules).toMatchObject({ calendar: false, matrix: true, habits: true })

    await user.click(calendar)
    expect(settings().modules.calendar).toBe(true)
  })

  test('toggles sidebar items', async () => {
    const user = userEvent.setup()
    renderSettings('modules')

    await user.click(screen.getByRole('switch', { name: '할 일 개수 표시' }))
    await user.click(screen.getByRole('switch', { name: '언젠가' }))

    expect(settings().sidebar).toMatchObject({ showCounts: false, showSomeday: false, showToday: true })
  })
})

describe('AboutTab', () => {
  test('shows the app name, version and storage explanation', () => {
    renderSettings('about')

    expect(screen.getByText('버전 1.0.0')).toBeInTheDocument()
    expect(screen.getByText(/서버로 보내지 않고/)).toBeInTheDocument()
    expect(screen.getByText('Pretendard')).toBeInTheDocument()
  })
})
