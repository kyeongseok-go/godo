import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DragGrip } from './DragGrip'

function setup(props: Partial<Parameters<typeof DragGrip>[0]> = {}) {
  const setActivatorNodeRef = vi.fn()
  const onCardClick = vi.fn()
  render(
    // 실제로는 카드 안에 들어가며, 카드를 누르면 상세가 열린다.
    <div onClick={onCardClick}>
      <DragGrip attributes={{ role: 'button', tabIndex: 0 }} listeners={undefined} setActivatorNodeRef={setActivatorNodeRef} {...props} />
    </div>,
  )
  return { setActivatorNodeRef, onCardClick }
}

describe('DragGrip', () => {
  test('is a labelled button, with a default and a custom label', () => {
    const { unmount } = render(<DragGrip attributes={{}} listeners={undefined} setActivatorNodeRef={() => {}} />)
    expect(screen.getByRole('button', { name: '끌어서 옮기기' })).toBeInTheDocument()
    unmount()

    render(<DragGrip attributes={{}} listeners={undefined} setActivatorNodeRef={() => {}} label="끌어서 순서 바꾸기" />)
    expect(screen.getByRole('button', { name: '끌어서 순서 바꾸기' })).toBeInTheDocument()
  })

  test('hands its element to the drag library as the activator', () => {
    const { setActivatorNodeRef } = setup()

    expect(setActivatorNodeRef).toHaveBeenCalledWith(screen.getByRole('button'))
  })

  test('passes the library attributes and pointer or keyboard listeners through', async () => {
    const user = userEvent.setup()
    const onKeyDown = vi.fn()
    const onPointerDown = vi.fn()
    setup({ attributes: { 'aria-roledescription': '정렬 가능', tabIndex: 0 }, listeners: { onKeyDown, onPointerDown } })
    const grip = screen.getByRole('button')

    expect(grip).toHaveAttribute('aria-roledescription', '정렬 가능')
    await user.pointer({ keys: '[MouseLeft>]', target: grip })
    expect(onPointerDown).toHaveBeenCalledTimes(1)
    grip.focus()
    await user.keyboard(' ')
    expect(onKeyDown).toHaveBeenCalled()
  })

  test('clicking it does not open the card it sits in', async () => {
    const user = userEvent.setup()
    const { onCardClick } = setup()

    await user.click(screen.getByRole('button'))

    expect(onCardClick).not.toHaveBeenCalled()
  })
})
