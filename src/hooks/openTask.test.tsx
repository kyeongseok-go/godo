import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import { useOpenTask } from './openTask'

interface Probe {
  open: ReturnType<typeof useOpenTask>
  location: ReturnType<typeof useLocation>
  navigate: ReturnType<typeof useNavigate>
  type: ReturnType<typeof useNavigationType>
}

function setup(initial = '/inbox') {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  return renderHook<Probe, void>(
    () => ({ open: useOpenTask(), location: useLocation(), navigate: useNavigate(), type: useNavigationType() }),
    { wrapper },
  )
}

describe('useOpenTask', () => {
  test('reads the open task id from the ?task= parameter', () => {
    expect(setup('/inbox?task=abc').result.current.open.openId).toBe('abc')
    expect(setup('/inbox').result.current.open.openId).toBeNull()
  })

  test('open puts the id in the URL, keeps other parameters and pushes a history entry', () => {
    const { result } = setup('/inbox?view=board')

    act(() => result.current.open.open('t1'))

    expect(result.current.open.openId).toBe('t1')
    expect(new URLSearchParams(result.current.location.search).get('view')).toBe('board')
    expect(result.current.location.pathname).toBe('/inbox')
    expect(result.current.type).toBe('PUSH')
  })

  test('close removes only the task parameter and replaces the history entry', () => {
    const { result } = setup('/inbox?view=board&task=t1')

    act(() => result.current.open.close())

    expect(result.current.open.openId).toBeNull()
    expect(result.current.location.search).toBe('?view=board')
    expect(result.current.type).toBe('REPLACE')
  })

  test('close without an open task leaves the other parameters intact', () => {
    const { result } = setup('/inbox')

    act(() => result.current.open.close())

    expect(result.current.open.openId).toBeNull()
    expect(result.current.location.pathname).toBe('/inbox')
  })

  test('open and close keep the same identity when the URL changes, so memoised rows are not invalidated', () => {
    const { result } = setup('/inbox')
    const { open, close } = result.current.open

    act(() => result.current.open.open('t1'))
    act(() => result.current.navigate('/today?view=list'))
    act(() => result.current.open.open('t2'))

    expect(result.current.open.open).toBe(open)
    expect(result.current.open.close).toBe(close)
  })

  test('a stable open still acts on the latest URL', () => {
    const { result } = setup('/inbox')
    const staleOpen = result.current.open.open

    act(() => result.current.navigate('/today?view=list'))
    act(() => staleOpen('t9'))

    expect(result.current.location.pathname).toBe('/today')
    expect(result.current.location.search).toBe('?view=list&task=t9')
  })
})
