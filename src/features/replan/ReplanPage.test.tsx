import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ReplanPage } from '../../app/pages/ReplanPage'
import { addDays, todayOf } from '../../domain/date'
import { makeTask } from '../../test/factories'
import { seedStore } from '../plan/testUtils'

describe('ReplanPage', () => {
  beforeEach(() => {
    seedStore([makeTask({ title: '지난주 일', startDate: addDays(todayOf(new Date(), 0), -3) })])
  })

  it('puts the session under a calm page header', () => {
    render(
      <MemoryRouter>
        <ReplanPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: '밀린 일 정리' })).toBeInTheDocument()
    expect(screen.getByText(/실패가 아니에요/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '지난주 일' })).toBeInTheDocument()
  })
})
