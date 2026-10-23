import { render, screen, act } from '@testing-library/react'
import { PHONE_QUERY, useMediaQuery } from './media'

function Probe({ query }: { query: string }) {
  return <p>{useMediaQuery(query) ? '맞음' : '아님'}</p>
}

/** jsdom 에는 matchMedia 가 없다. 조건을 바꿔 가며 알릴 수 있는 가짜를 심는다. */
function installMatchMedia(initial: boolean): (next: boolean) => void {
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  let matches = initial
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return matches
    },
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    matches = next
    for (const fn of listeners) fn({ matches: next } as MediaQueryListEvent)
  }
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('useMediaQuery', () => {
  it('조건에 맞으면 참을 돌려준다', () => {
    installMatchMedia(true)
    render(<Probe query={PHONE_QUERY} />)
    expect(screen.getByText('맞음')).toBeInTheDocument()
  })

  it('화면 크기가 바뀌면 따라 바뀐다', () => {
    const change = installMatchMedia(false)
    render(<Probe query={PHONE_QUERY} />)
    expect(screen.getByText('아님')).toBeInTheDocument()

    act(() => change(true))

    expect(screen.getByText('맞음')).toBeInTheDocument()
  })

  it('matchMedia 가 없는 환경에서는 넓은 화면으로 본다', () => {
    render(<Probe query={PHONE_QUERY} />)
    expect(screen.getByText('아님')).toBeInTheDocument()
  })
})
