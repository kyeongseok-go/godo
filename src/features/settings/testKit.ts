// 설정 화면 컴포넌트 테스트가 함께 쓰는 도구
import { render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SettingsView } from './SettingsView'

/** jsdom 은 <dialog> 의 showModal/close 를 구현하지 않는다. */
export function polyfillDialog(): void {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
}

function LocationProbe(): ReactElement {
  return createElement('output', { 'data-testid': 'location' }, useLocation().pathname)
}

/** 라우터 안에서 컴포넌트를 그린다. 현재 경로는 data-testid="location" 으로 읽는다. */
export function renderInRouter(ui: ReactElement, route = '/settings/general') {
  return render(createElement(MemoryRouter, { initialEntries: [route] }, ui, createElement(LocationProbe)))
}

export function renderSettings(tab: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [`/settings/${tab}`] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/settings/:tab', element: createElement(SettingsView) }),
        createElement(Route, { path: '*', element: createElement(LocationProbe) }),
      ),
      createElement(LocationProbe),
    ),
  )
}
