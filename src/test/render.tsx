import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../store/app'
import { useApp } from '../store/app'
import { useUI } from '../store/ui'

/** 전역 스토어와 DB를 초기 상태로 되돌린다. 컴포넌트 테스트 사이의 오염을 막는다. */
export async function resetApp(): Promise<void> {
  await db.delete()
  await db.open()
  useApp.setState({ ready: false, undoStack: [], redoStack: [], persistError: null })
  await useApp.getState().reload()
  useUI.setState({ selectedIds: [], focusedId: null, collapsed: {}, quickAdd: { open: false, defaults: {} }, paletteOpen: false, helpOpen: false, entityDialog: null })
}

export function renderApp(ui: ReactElement, route = '/inbox') {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}
