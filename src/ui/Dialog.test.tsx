import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Dialog } from './Dialog'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
    // 실제 브라우저처럼 close 이벤트는 비동기로 한 번 더 온다.
    setTimeout(() => this.dispatchEvent(new Event('close')), 0)
  }
})

function Harness({ onClosed }: { onClosed: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button onClick={() => setOpen((v) => !v)}>toggle</button>
      <Dialog
        open={open}
        label="시험"
        onClose={() => {
          onClosed()
          setOpen(false)
        }}
      >
        <p>내용</p>
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  test('a dialog reopened right after a programmatic close is not closed by the late close event', async () => {
    const onClosed = vi.fn()
    render(<Harness onClosed={onClosed} />)

    // 닫았다가 곧바로 다시 연다. 이전 close의 지연 이벤트가 새 대화상자를 닫으면 안 된다.
    act(() => screen.getByText('toggle').click())
    act(() => screen.getByText('toggle').click())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(onClosed).not.toHaveBeenCalled()
    expect(screen.getByText('내용')).toBeInTheDocument()
  })

  test('renders children only while open', () => {
    render(<Dialog open={false} onClose={() => {}} label="x"><p>보이면 안 됨</p></Dialog>)

    expect(screen.queryByText('보이면 안 됨')).not.toBeInTheDocument()
  })
})
