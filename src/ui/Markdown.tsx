import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'
import './markdown.css'

// 허용 목록(allowlist) 방식. DOMPurify 기본값은 <style>, style 속성, <form>/<input>/<button>, svg, mathml 을 통과시켜
// 가져온 파일 한 줄로 앱 전체를 가리거나(전역 CSS) 가짜 입력창을 띄울 수 있다. 마크다운이 만드는 태그만 남긴다.
const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'code', 'del', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'input', 'li', 'ol', 'p', 'pre', 'strong',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
  // 마크다운 안에 직접 쓰는 가벼운 HTML
  'b', 'i', 'u', 's', 'sub', 'sup', 'kbd', 'mark', 'small', 'span', 'div', 'details', 'summary',
]
// class·style·id·name 은 일부러 뺀다: 앱 UI 클래스 흉내, 화면 덮기, DOM 클로버링을 막는다.
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'type', 'checked', 'disabled', 'align', 'start', 'colspan', 'rowspan', 'open']

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // 링크는 새 탭에서 열되 window.opener를 넘기지 않는다.
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
  if (node.tagName !== 'INPUT') return
  // 입력 요소는 체크리스트(- [x])의 체크박스만 허용한다. 텍스트·비밀번호 입력은 로그인 창 흉내에 쓰인다.
  if (node.getAttribute('type') !== 'checkbox') {
    node.remove()
    return
  }
  node.setAttribute('disabled', '')
  // 체크박스에는 항목 글자를 접근 가능한 이름으로 붙인다.
  const label = node.parentElement?.textContent?.trim()
  node.setAttribute('aria-label', label || '체크 항목')
})

/** 마크다운 → 안전한 HTML. 사용자 입력이므로 항상 정화한 뒤에만 DOM에 넣는다. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false, gfm: true, breaks: true }) as string
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false })
}

export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  // 정화된 HTML만 주입한다(renderMarkdown 참고).
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
