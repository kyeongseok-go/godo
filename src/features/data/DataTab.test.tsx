import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createBackup, emptyAppData, serializeBackup } from '../../domain/exchange'
import { db, useApp } from '../../store/app'
import { useToasts } from '../../ui/toast'
import { makeLabel, makeProject, makeTask } from '../../test/factories'
import { resetApp } from '../../test/render'
import { polyfillDialog, renderInRouter } from '../settings/testKit'
import { DataTab } from './DataTab'
import { createSnapshot, listSnapshots } from './snapshots'

beforeAll(polyfillDialog)

beforeEach(async () => {
  await resetApp()
  useToasts.setState({ toasts: [] })
})

const state = () => useApp.getState()
const seed = (title = '기존 할 일') =>
  state().commit({ puts: { tasks: [makeTask({ id: 'old', title, updatedAt: 10 })] }, deletes: {} }, '준비', { history: false })

const backupFile = (data = emptyAppData(), name = 'godo-backup.json') =>
  new File([serializeBackup(createBackup(data, '2026-10-23T09:00:00.000Z'))], name, { type: 'application/json' })

const fileInput = (container: HTMLElement): HTMLInputElement => {
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('파일 입력을 찾지 못했어요')
  return input
}

describe('ExportSection', () => {
  let clicked: Array<{ download: string; href: string }>
  let blobs: Blob[]

  beforeEach(() => {
    clicked = []
    blobs = []
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob)
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('downloads a JSON backup named with today and holding the whole store', async () => {
    const user = userEvent.setup()
    seed('내보낼 할 일')
    renderInRouter(<DataTab />)

    await user.click(screen.getByRole('button', { name: /JSON 백업 내려받기/ }))

    expect(clicked[0].download).toMatch(/^godo-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = JSON.parse(await blobs[0].text()) as { app: string; data: { tasks: Array<{ title: string }>; settings: unknown } }
    expect(parsed.app).toBe('godo')
    expect(parsed.data.tasks.map((t) => t.title)).toEqual(['내보낼 할 일'])
    expect(parsed.data.settings).not.toBeNull()
    expect(useToasts.getState().toasts[0].message).toBe('백업 파일을 내려받았어요')
  })

  test('downloads a CSV with a BOM and the Todoist header', async () => {
    const user = userEvent.setup()
    seed('엑셀로 볼 일')
    renderInRouter(<DataTab />)

    await user.click(screen.getByRole('button', { name: /CSV 내려받기/ }))

    expect(clicked[0].download).toMatch(/^godo-tasks-\d{4}-\d{2}-\d{2}\.csv$/)
    // Blob.text() 는 BOM 을 떼고 읽으므로 바이트로 확인한다.
    const bytes = new Uint8Array(await blobs[0].arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = await blobs[0].text()
    expect(text.startsWith('TYPE,CONTENT')).toBe(true)
    expect(text).toContain('엑셀로 볼 일')
  })

  test('tells the user when the file cannot be created', async () => {
    const user = userEvent.setup()
    URL.createObjectURL = vi.fn(() => {
      throw new Error('차단됨')
    })
    renderInRouter(<DataTab />)

    await user.click(screen.getByRole('button', { name: /JSON 백업 내려받기/ }))

    expect(useToasts.getState().toasts[0]).toMatchObject({ tone: 'error', message: expect.stringContaining('차단됨') })
  })
})

describe('ImportSection JSON', () => {
  test('previews counts and merges without losing current data', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(
      fileInput(container),
      backupFile({ ...emptyAppData(), tasks: [makeTask({ id: 'new', title: '가져온 할 일' })], labels: [makeLabel({ id: 'l' })] }),
    )

    // 파일 읽기와 검증은 비동기라 부하가 큰 실행에서는 기본 1초를 넘길 수 있다.
    const preview = await screen.findByText('godo-backup.json', undefined, { timeout: 15000 })
    expect(preview).toBeInTheDocument()
    expect(screen.getByText('할 일').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('라벨').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('radio', { name: /병합/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: '병합해서 가져오기' }))

    await waitFor(() => expect(Object.keys(state().entities.tasks).sort()).toEqual(['new', 'old']))
    expect(await db.tasks.count()).toBe(2)
    // 가져오기는 비동기라 미리보기가 사라지기까지 한 박자 걸린다
    await waitFor(() => expect(screen.queryByText('godo-backup.json')).not.toBeInTheDocument())
    expect(useToasts.getState().toasts.at(-1)?.message).toBe('새 항목 2개를 더하고 0개를 갱신했어요')
  })

  test('asks for confirmation before replacing and keeps a safety snapshot', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), backupFile({ ...emptyAppData(), tasks: [makeTask({ id: 'only', title: '이것만' })] }))
    await user.click(await screen.findByRole('radio', { name: /덮어쓰기/ }))
    await user.click(screen.getByRole('button', { name: '덮어쓰기' }))

    const dialog = await screen.findByRole('dialog', { name: '현재 데이터를 덮어쓸까요?' })
    expect(within(dialog).getByText('현재 데이터는 사라져요.')).toBeInTheDocument()
    expect(Object.keys(state().entities.tasks)).toEqual(['old'])

    await user.click(within(dialog).getByRole('button', { name: '덮어쓰기' }))

    await waitFor(() => expect(Object.keys(state().entities.tasks)).toEqual(['only']))
    expect(await listSnapshots(db)).toHaveLength(1)
  })

  test('lists the safety snapshot right after a replace without reopening the tab', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderInRouter(<DataTab />)
    expect(await screen.findByText(/아직 스냅샷이 없어요/)).toBeInTheDocument()

    await user.upload(fileInput(container), backupFile({ ...emptyAppData(), tasks: [makeTask({ id: 'only' })] }))
    await user.click(await screen.findByRole('radio', { name: /덮어쓰기/ }))
    await user.click(screen.getByRole('button', { name: '덮어쓰기' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '덮어쓰기' }))

    expect(await screen.findByRole('list', { name: '스냅샷 목록' })).toBeInTheDocument()
  })

  test('cancelling the confirmation keeps everything', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), backupFile({ ...emptyAppData(), tasks: [makeTask({ id: 'only' })] }))
    await user.click(await screen.findByRole('radio', { name: /덮어쓰기/ }))
    await user.click(screen.getByRole('button', { name: '덮어쓰기' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '취소' }))

    expect(Object.keys(state().entities.tasks)).toEqual(['old'])
  })

  test('shows warnings for entries that were skipped', async () => {
    const user = userEvent.setup()
    const text = JSON.stringify({
      app: 'godo',
      version: 1,
      exportedAt: '2026-10-23T00:00:00.000Z',
      data: { tasks: [{ id: 'broken' }, makeTask({ id: 'ok' })] },
    })
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), new File([text], 'warn.json'))

    expect(await screen.findByText('확인할 점 1개')).toBeInTheDocument()
    expect(screen.getByText('작업 1개를 건너뛰었어요')).toBeInTheDocument()
  })

  test('shows a Korean error for a file that is not a backup and leaves data alone', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), new File(['{깨진 json'], 'bad.json'))

    expect(await screen.findByRole('alert')).toHaveTextContent('JSON 형식이 올바르지 않아요')
    expect(Object.keys(state().entities.tasks)).toEqual(['old'])
  })

  test('rejects an empty file', async () => {
    const user = userEvent.setup()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), new File([''], 'empty.json'))

    expect(await screen.findByRole('alert')).toHaveTextContent('빈 파일이에요')
  })

  test('disables importing a backup that holds nothing', async () => {
    const user = userEvent.setup()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), backupFile())

    expect(await screen.findByText(/가져올 항목이 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '병합해서 가져오기' })).toBeDisabled()
  })

  test('cancel clears the preview', async () => {
    const user = userEvent.setup()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), backupFile({ ...emptyAppData(), tasks: [makeTask()] }))
    await user.click(await screen.findByRole('button', { name: '취소' }))

    // 가져오기는 비동기라 미리보기가 사라지기까지 한 박자 걸린다
    await waitFor(() => expect(screen.queryByText('godo-backup.json')).not.toBeInTheDocument())
  })
})

describe('ImportSection CSV', () => {
  const csv = ['TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT', 'section,준비,,,', 'task,박스 구하기,,1,1', 'task,테이프,,4,2'].join('\n')

  test('imports a Todoist CSV as a new project with a chosen name', async () => {
    const user = userEvent.setup()
    seed()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), new File([csv], '이사.csv', { type: 'text/csv' }))
    const name = await screen.findByLabelText('새 프로젝트 이름')
    expect(name).toHaveValue('이사')
    await user.clear(name)
    await user.type(name, '새 집 이사')
    await user.click(screen.getByRole('button', { name: '새 프로젝트로 가져오기' }))

    await waitFor(() => expect(Object.values(state().entities.projects).some((p) => p.name === '새 집 이사')).toBe(true))
    const project = Object.values(state().entities.projects).find((p) => p.name === '새 집 이사')
    const imported = Object.values(state().entities.tasks).filter((t) => t.projectId === project?.id)
    expect(imported.map((t) => t.title).sort()).toEqual(['박스 구하기', '테이프'])
    expect(state().entities.tasks.old.title).toBe('기존 할 일')
    expect(Object.values(state().entities.sections).some((s) => s.projectId === project?.id && s.name === '준비')).toBe(true)
  })

  test('shows the CSV header error for a wrong file', async () => {
    const user = userEvent.setup()
    const { container } = renderInRouter(<DataTab />)

    await user.upload(fileInput(container), new File(['a,b\n1,2'], 'x.csv'))

    expect(await screen.findByRole('alert')).toHaveTextContent('TYPE, CONTENT')
  })
})

describe('SnapshotSection', () => {
  test('creates a snapshot on demand and lists it with its size', async () => {
    const user = userEvent.setup()
    seed()
    renderInRouter(<DataTab />)
    expect(await screen.findByText(/아직 스냅샷이 없어요/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '지금 스냅샷 만들기' }))

    const list = await screen.findByRole('list', { name: '스냅샷 목록' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(within(list).getByText(/KB| B$/)).toBeInTheDocument()
  })

  test('restores a snapshot after confirmation and keeps the pre-restore state as a snapshot', async () => {
    const user = userEvent.setup()
    await createSnapshot(db, { ...emptyAppData(), tasks: [makeTask({ id: 'past', title: '과거의 할 일' })] }, Date.now() - 3_600_000, 'snap-1')
    seed('현재의 할 일')
    renderInRouter(<DataTab />)

    await user.click(await screen.findByRole('button', { name: /스냅샷으로 복원/ }))
    const dialog = await screen.findByRole('dialog', { name: '이 시점으로 복원할까요?' })
    expect(within(dialog).getByText('현재 데이터는 사라져요.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: '복원' }))

    await waitFor(() => expect(Object.keys(state().entities.tasks)).toEqual(['past']))
    expect((await listSnapshots(db)).length).toBe(2)
  })

  test('shows a Korean error when the snapshot is corrupted and keeps the data', async () => {
    const user = userEvent.setup()
    await db.snapshots.put({ id: 'bad', createdAt: Date.now() - 1000, data: '{깨짐' })
    seed()
    renderInRouter(<DataTab />)

    await user.click(await screen.findByRole('button', { name: /스냅샷으로 복원/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '복원' }))

    expect(await screen.findByText(/스냅샷을 읽지 못했어요/)).toBeInTheDocument()
    expect(Object.keys(state().entities.tasks)).toEqual(['old'])
  })
})

describe('TrashSection', () => {
  test('explains the retention period and empties the trash after confirmation', async () => {
    const user = userEvent.setup()
    state().commit({ puts: { tasks: [makeTask({ id: 't1', deletedAt: 5 }), makeTask({ id: 't2' })] }, deletes: {} }, '준비', { history: false })
    renderInRouter(<DataTab />)

    expect(screen.getByText(/30일 동안 휴지통에 두었다가/)).toBeInTheDocument()
    expect(screen.getByText('휴지통에 할 일 1개')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /휴지통 비우기/ }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '비우기' }))

    expect(Object.keys(state().entities.tasks)).toEqual(['t2'])
  })

  test('disables emptying when the trash is empty', () => {
    renderInRouter(<DataTab />)

    expect(screen.getByRole('button', { name: /휴지통 비우기/ })).toBeDisabled()
    expect(screen.getByText('휴지통이 비어 있어요')).toBeInTheDocument()
  })
})

describe('DangerSection', () => {
  test('keeps the delete button disabled until the exact word is typed', async () => {
    const user = userEvent.setup()
    renderInRouter(<DataTab />)
    const button = screen.getByRole('button', { name: '모든 데이터 삭제' })
    const input = screen.getByLabelText(/직접 입력하세요/)

    expect(button).toBeDisabled()
    await user.type(input, '삭')
    expect(button).toBeDisabled()
    await user.type(input, '제')
    expect(button).toBeEnabled()
  })

  test('wipes data, settings and snapshots, then recovers a default state', async () => {
    const user = userEvent.setup()
    seed()
    state().updateSettings({ theme: 'dark' })
    state().commit({ puts: { projects: [makeProject({ id: 'p' })] }, deletes: {} }, '준비', { history: false })
    await createSnapshot(db, emptyAppData(), Date.now() - 1000, 's')
    renderInRouter(<DataTab />)

    await user.type(screen.getByLabelText(/직접 입력하세요/), '삭제')
    await user.click(screen.getByRole('button', { name: '모든 데이터 삭제' }))

    await waitFor(() => expect(Object.keys(state().entities.tasks)).toEqual([]))
    expect(Object.keys(state().entities.projects)).toEqual(['inbox'])
    expect(state().settings.theme).toBe('auto')
    expect(await db.snapshots.count()).toBe(0)
    expect(screen.getByLabelText(/직접 입력하세요/)).toHaveValue('')
  })
})
