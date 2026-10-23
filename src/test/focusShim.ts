const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * jsdom 에는 `<dialog>.showModal()` 이 없다. 열기와 함께 브라우저의 포커스 규칙까지 흉내 낸다.
 * 브라우저는 `autofocus` **속성**이 붙은 요소를 찾고, 없으면 첫 초점 가능 요소(보통 '닫기' 버튼)를 잡는다.
 * React 의 `autoFocus` 는 속성을 남기지 않으므로 이 규칙에 걸리지 않는다는 점까지 그대로 재현된다.
 */
export function installModalDialogFocusShim(): void {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
      const target = this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  })
}

/**
 * jsdom 은 `visibility:hidden` 요소의 focus() 도 그대로 받아 준다. 실제 브라우저는 무시한다.
 * 이 셔임을 깔면 "팝오버가 위치 계산을 마치고 보이게 된 뒤에만 포커스가 들어간다"는 조건을
 * 테스트에서도 재현할 수 있다. 쓰려는 테스트 파일에서 한 번 부르면 된다.
 */
export function installHiddenPanelFocusShim(): void {
  const real = HTMLElement.prototype.focus

  beforeAll(() => {
    HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
      const panel = this.closest<HTMLElement>('.popover')
      if (panel && panel.style.visibility === 'hidden') return
      real.call(this, options)
    }
  })

  afterAll(() => {
    HTMLElement.prototype.focus = real
  })
}
